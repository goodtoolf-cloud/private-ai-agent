"""
FILE: backend/routers/memory.py
User memory — remembers facts, preferences, and history across sessions.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database import get_db
from models import UserMemory
from services.chroma_service import store_memory_chunk, search_memory

router = APIRouter()


class MemoryCreate(BaseModel):
    key: str
    value: str
    category: str = "general"


class MemorySearch(BaseModel):
    query: str
    n_results: int = 5


@router.post("/")
async def add_memory(req: MemoryCreate, db: AsyncSession = Depends(get_db)):
    """Manually add a memory fact."""
    # Check for existing key
    result = await db.execute(select(UserMemory).where(UserMemory.key == req.key))
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = req.value
        existing.category = req.category
    else:
        mem = UserMemory(key=req.key, value=req.value, category=req.category)
        db.add(mem)
    await db.commit()

    # Also store in vector DB
    await store_memory_chunk(
        f"{req.key}: {req.value}",
        metadata={"key": req.key, "category": req.category, "type": "user_memory"},
    )

    return {"success": True, "key": req.key}


@router.get("/")
async def list_memories(db: AsyncSession = Depends(get_db)):
    """List all stored user memories."""
    result = await db.execute(select(UserMemory).order_by(UserMemory.category.asc()))
    memories = result.scalars().all()
    return [
        {
            "id": m.id,
            "key": m.key,
            "value": m.value,
            "category": m.category,
            "last_updated": m.last_updated.isoformat(),
        }
        for m in memories
    ]


@router.post("/search")
async def search(req: MemorySearch):
    """Semantic search over stored memories."""
    results = await search_memory(req.query, req.n_results)
    return {"query": req.query, "results": results}


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserMemory).where(UserMemory.id == memory_id))
    mem = result.scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=404, detail="Memory not found")
    await db.delete(mem)
    await db.commit()
    return {"success": True}


@router.delete("/")
async def clear_all_memories(db: AsyncSession = Depends(get_db)):
    """Clear all user memories."""
    await db.execute(delete(UserMemory))
    await db.commit()
    return {"success": True, "message": "All memories cleared"}
