"""
FILE: backend/routers/chat.py
Core chat endpoint — model selection, streaming, memory, RAG context.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from database import get_db
from models import Conversation, Message
from services.cloudflare import auto_select_model, chat_complete, chat_complete_stream, model_can_handle
from services.chroma_service import search_memory, search_knowledge, store_memory_chunk

router = APIRouter()

SYSTEM_PROMPT = """You are a private AI assistant. You are helpful, thorough, and honest.

When answering:
- Break complex tasks into clear steps before executing them.
- If you are uncertain, say so — never guess silently.
- After every answer, privately assess your confidence (0-100%) and include it at the end in this format:
  [Confidence: XX% | Sources: N]
- If confidence is below 60%, explicitly warn the user before giving the answer.
- For research tasks: plan → gather → analyze → verify → answer.
- Never fabricate facts. If you don't know, say "I don't have reliable information on this."
"""


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    model: str = "auto"   # "auto" | "deepseek" | "llama" | "gemini"
    stream: bool = False
    include_web_search: bool = False
    has_file: bool = False
    file_type: str = ""


class ChatResponse(BaseModel):
    reply: str
    model_used: str
    conversation_id: str
    confidence: float | None = None
    sources_count: int = 0
    warning: str | None = None


@router.post("/", response_model=ChatResponse)
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    # 1. Model selection
    if req.model == "auto":
        model_key = auto_select_model(req.message, req.has_file, req.file_type)
        warning = None
    else:
        model_key = req.model
        can_handle, warn_msg = model_can_handle(req.model, req.message, req.has_file)
        warning = warn_msg if not can_handle else None
        if not can_handle:
            model_key = auto_select_model(req.message, req.has_file, req.file_type)

    # 2. Get or create conversation
    if req.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == req.conversation_id)
        )
        conv = result.scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = Conversation(model_used=model_key)
        db.add(conv)
        await db.flush()

    # 3. Load conversation history
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .limit(20)
    )
    history = result.scalars().all()
    messages = [{"role": m.role, "content": m.content} for m in history]

    # 4. RAG: search memory + knowledge base
    memory_chunks = await search_memory(req.message, n_results=3)
    knowledge_chunks = await search_knowledge(req.message, n_results=5)

    context_parts = []
    if memory_chunks:
        mem_text = "\n".join([c["text"] for c in memory_chunks])
        context_parts.append(f"[What I remember about you]\n{mem_text}")
    if knowledge_chunks:
        know_text = "\n".join([
            f"[From: {c['metadata'].get('document_title', 'Knowledge Base')} | Trust: {c['metadata'].get('trust_level', 2)}/3]\n{c['text']}"
            for c in knowledge_chunks
        ])
        context_parts.append(f"[Relevant knowledge]\n{know_text}")

    user_message = req.message
    if context_parts:
        user_message = "\n\n".join(context_parts) + "\n\n[User message]\n" + req.message

    messages.append({"role": "user", "content": user_message})

    # 5. Call AI
    result_data = await chat_complete(
        messages=messages,
        model_key=model_key,
        system_prompt=SYSTEM_PROMPT,
    )
    reply_text = result_data["text"]

    # 6. Parse confidence from response
    confidence = None
    sources_count = len(knowledge_chunks)
    if "[Confidence:" in reply_text:
        try:
            conf_start = reply_text.index("[Confidence:") + len("[Confidence:")
            conf_end = reply_text.index("%", conf_start)
            confidence = float(reply_text[conf_start:conf_end].strip())
        except Exception:
            pass

    # 7. Save messages to DB
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=req.message,
    )
    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=reply_text,
        model_used=model_key,
        confidence=confidence,
        sources_count=sources_count,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.commit()

    # 8. Store this exchange in memory for future context
    memory_text = f"User asked: {req.message[:200]}\nAssistant answered: {reply_text[:400]}"
    await store_memory_chunk(
        memory_text,
        metadata={"conversation_id": conv.id, "model": model_key},
    )

    if not conv.title and req.message:
        conv.title = req.message[:60]
        await db.commit()

    return ChatResponse(
        reply=reply_text,
        model_used=model_key,
        conversation_id=conv.id,
        confidence=confidence,
        sources_count=sources_count,
        warning=warning,
    )


@router.get("/stream")
async def chat_stream(
    message: str,
    conversation_id: str | None = None,
    model: str = "auto",
):
    """Server-Sent Events streaming endpoint."""
    model_key = auto_select_model(message) if model == "auto" else model

    messages = [{"role": "user", "content": message}]

    async def event_generator():
        async for token in chat_complete_stream(messages, model_key, SYSTEM_PROMPT):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/conversations")
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).order_by(Conversation.updated_at.desc()).limit(50)
    )
    convs = result.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title or "Untitled",
            "model_used": c.model_used,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in convs
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    msgs = result.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "model_used": m.model_used,
            "confidence": m.confidence,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(conv)
    await db.commit()
    return {"success": True}
