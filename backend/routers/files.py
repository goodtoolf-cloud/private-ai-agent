"""
FILE: backend/routers/files.py
File upload, parsing, and AI analysis.
"""

import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import UploadedFile
from services.file_parser import parse_file
from services.cloudflare import auto_select_model, chat_complete
from config import get_settings

router = APIRouter()
settings = get_settings()

ALLOWED_EXTENSIONS = {
    "pdf", "docx", "doc", "xlsx", "xls", "csv",
    "png", "jpg", "jpeg", "gif", "webp", "bmp",
    "mp3", "mp4", "wav", "m4a", "ogg", "webm",
    "txt", "md", "json", "xml", "html", "py", "js", "ts",
}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    question: str = Form("Analyze this file and summarize its key contents."),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file and immediately analyze it with AI."""
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type .{ext} not supported.")

    # Save file
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    filepath = os.path.join(settings.upload_dir, filename)
    os.makedirs(settings.upload_dir, exist_ok=True)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(filepath)

    # Parse content
    parsed = parse_file(filepath, ext)

    # Pick model
    model_key = auto_select_model(question, has_file=True, file_type=ext)

    # Build context for AI
    file_context = f"""[Uploaded file: {file.filename}]
Type: {ext.upper()} | Size: {file_size:,} bytes

Extracted content:
{parsed['text'][:6000]}
"""
    if parsed.get("tables"):
        file_context += f"\n[Tables found: {len(parsed['tables'])}]"
    if parsed.get("metadata"):
        file_context += f"\n[Metadata: {parsed['metadata']}]"

    messages = [
        {"role": "user", "content": f"{file_context}\n\nUser question: {question}"}
    ]

    result = await chat_complete(messages=messages, model_key=model_key)

    # Save to DB
    db_file = UploadedFile(
        id=file_id,
        filename=filename,
        original_name=file.filename,
        file_type=ext,
        file_size=file_size,
        content_summary=result["text"][:1000],
        is_knowledge_base=False,
    )
    db.add(db_file)
    await db.commit()

    return {
        "file_id": file_id,
        "filename": file.filename,
        "file_type": ext,
        "file_size": file_size,
        "parsed_text_length": len(parsed["text"]),
        "tables_found": len(parsed.get("tables", [])),
        "analysis": result["text"],
        "model_used": model_key,
    }


@router.get("/")
async def list_files(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UploadedFile).order_by(UploadedFile.created_at.desc()).limit(100)
    )
    files = result.scalars().all()
    return [
        {
            "id": f.id,
            "original_name": f.original_name,
            "file_type": f.file_type,
            "file_size": f.file_size,
            "content_summary": f.content_summary,
            "is_knowledge_base": f.is_knowledge_base,
            "created_at": f.created_at.isoformat(),
        }
        for f in files
    ]


@router.delete("/{file_id}")
async def delete_file(file_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    f = result.scalar_one_or_none()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    filepath = os.path.join(settings.upload_dir, f.filename)
    if os.path.exists(filepath):
        os.remove(filepath)
    await db.delete(f)
    await db.commit()
    return {"success": True}
