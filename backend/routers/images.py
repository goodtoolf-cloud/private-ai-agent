"""
FILE: backend/routers/images.py
Image generation via Cloudflare Workers AI (Stable Diffusion).
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import GeneratedFile
from services.image_gen import generate_image

router = APIRouter()


class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, distorted, ugly, watermark"
    width: int = 1024
    height: int = 1024
    steps: int = 20


@router.post("/generate")
async def generate(req: ImageRequest, db: AsyncSession = Depends(get_db)):
    """Generate an image from a text prompt."""
    result = await generate_image(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt,
        width=req.width,
        height=req.height,
        steps=req.steps,
    )

    # Save record
    gf = GeneratedFile(
        filename=result["filename"],
        file_type="png",
        description=req.prompt,
        url_path=result["url"],
    )
    db.add(gf)
    await db.commit()

    return result


@router.get("/")
async def list_images(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GeneratedFile)
        .where(GeneratedFile.file_type == "png")
        .order_by(GeneratedFile.created_at.desc())
        .limit(50)
    )
    images = result.scalars().all()
    return [
        {
            "id": img.id,
            "url": img.url_path,
            "description": img.description,
            "created_at": img.created_at.isoformat(),
        }
        for img in images
    ]
