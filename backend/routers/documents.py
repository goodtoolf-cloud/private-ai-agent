"""
FILE: backend/routers/documents.py
AI-powered document creation — Word, PDF, Excel.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import GeneratedFile
from services.document_creator import create_docx, create_pdf, create_xlsx
from services.cloudflare import chat_complete

router = APIRouter()


class DocumentRequest(BaseModel):
    topic: str
    format: str = "pdf"   # pdf | docx | xlsx
    instructions: str = ""
    data: list[list] = []        # for xlsx only
    headers: list[str] = []      # for xlsx only


@router.post("/create")
async def create_document(req: DocumentRequest, db: AsyncSession = Depends(get_db)):
    """
    Ask AI to generate document content, then create the actual file.
    Supports PDF, DOCX, and XLSX.
    """
    if req.format == "xlsx":
        # For Excel, use provided data or ask AI to generate it
        if not req.data:
            ai_prompt = f"""Generate structured table data for: {req.topic}
{req.instructions}
Return ONLY a JSON array of arrays (rows), with the first row being headers.
Example: [["Name","Value","Category"],["Item1",100,"A"]]
Return ONLY the JSON, no explanation."""
            result = await chat_complete(
                messages=[{"role": "user", "content": ai_prompt}],
                model_key="deepseek",
            )
            import json
            try:
                all_rows = json.loads(result["text"].strip())
                headers = all_rows[0] if all_rows else []
                data = all_rows[1:] if len(all_rows) > 1 else []
            except Exception:
                headers = req.headers or ["Column 1", "Column 2"]
                data = req.data or []
        else:
            headers = req.headers
            data = req.data

        file_result = await create_xlsx(req.topic, data, headers)

    else:
        # Generate document content with AI
        format_name = "Word document" if req.format == "docx" else "PDF document"
        ai_prompt = f"""Write comprehensive content for a {format_name} about: {req.topic}
{req.instructions}

Format the content with clear sections using markdown headings (# for main title, ## for sections).
Write complete, detailed content — not just an outline.
"""
        result = await chat_complete(
            messages=[{"role": "user", "content": ai_prompt}],
            model_key="deepseek",
        )
        content = result["text"]

        if req.format == "docx":
            file_result = await create_docx(req.topic, content)
        else:
            file_result = await create_pdf(req.topic, content)

    # Save to DB
    gf = GeneratedFile(
        filename=file_result["filename"],
        file_type=req.format,
        description=req.topic,
        url_path=file_result["url"],
    )
    db.add(gf)
    await db.commit()

    return {
        "filename": file_result["filename"],
        "url": file_result["url"],
        "type": req.format,
        "topic": req.topic,
    }


@router.get("/")
async def list_documents(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(
        select(GeneratedFile)
        .where(GeneratedFile.file_type.in_(["pdf", "docx", "xlsx"]))
        .order_by(GeneratedFile.created_at.desc())
        .limit(50)
    )
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "type": d.file_type,
            "description": d.description,
            "url": d.url_path,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]
