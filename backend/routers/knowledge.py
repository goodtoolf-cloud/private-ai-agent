"""
FILE: backend/routers/knowledge.py
Knowledge base — upload documents once, agent uses them forever.
"""

import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import KnowledgeDocument, UploadedFile
from services.file_parser import parse_file
from services.chroma_service import store_knowledge_chunk, search_knowledge, delete_document_chunks, chunk_text
from config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/upload")
async def upload_to_knowledge_base(
    file: UploadFile = File(...),
    title: str = Form(""),
    trust_level: int = Form(2),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a document to the permanent knowledge base.
    The agent will automatically use it in all future conversations.
    Trust levels: 1=low, 2=medium, 3=high (affects conflict resolution)
    """
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "txt"
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    filepath = os.path.join(settings.upload_dir, filename)
    os.makedirs(settings.upload_dir, exist_ok=True)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(filepath)
    doc_title = title or file.filename

    # Parse content
    parsed = parse_file(filepath, ext)
    text = parsed["text"]

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file.")

    # Save uploaded file record
    db_file = UploadedFile(
        id=file_id,
        filename=filename,
        original_name=file.filename,
        file_type=ext,
        file_size=file_size,
        is_knowledge_base=True,
        trust_level=trust_level,
    )
    db.add(db_file)

    # Create knowledge document record
    doc_id = str(uuid.uuid4())
    kb_doc = KnowledgeDocument(
        id=doc_id,
        title=doc_title,
        file_id=file_id,
        trust_level=trust_level,
    )

    # Chunk and embed the text
    chunks = chunk_text(text, chunk_size=600, overlap=100)
    for i, chunk in enumerate(chunks):
        await store_knowledge_chunk(
            text=chunk,
            document_id=doc_id,
            document_title=doc_title,
            trust_level=trust_level,
            chunk_index=i,
        )

    kb_doc.chunk_count = len(chunks)
    db.add(kb_doc)
    await db.commit()

    return {
        "document_id": doc_id,
        "title": doc_title,
        "file": file.filename,
        "chunks_stored": len(chunks),
        "trust_level": trust_level,
        "message": f"Document '{doc_title}' added to knowledge base with {len(chunks)} searchable chunks.",
    }


@router.get("/")
async def list_knowledge_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "trust_level": d.trust_level,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.post("/search")
async def search(query: str, n_results: int = 8):
    """Search the knowledge base by semantic similarity."""
    results = await search_knowledge(query, n_results)
    return {"query": query, "results": results, "count": len(results)}


@router.patch("/{document_id}/trust")
async def update_trust_level(document_id: str, trust_level: int, db: AsyncSession = Depends(get_db)):
    """Update the trust ranking for a knowledge document (1=low, 2=medium, 3=high)."""
    if trust_level not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="Trust level must be 1, 2, or 3")
    result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.trust_level = trust_level
    await db.commit()
    return {"success": True, "document_id": document_id, "trust_level": trust_level}


@router.delete("/{document_id}")
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db)):
    """Remove a document from the knowledge base."""
    result = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete all vector chunks
    await delete_document_chunks(document_id)

    await db.delete(doc)
    await db.commit()
    return {"success": True, "message": f"Document and all its chunks removed from knowledge base."}
