"""
FILE: backend/main.py
Entry point for the Private AI Agent FastAPI backend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from database import engine, Base
from routers import chat, files, search, images, code, memory, documents, voice, alerts, knowledge

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create upload/output dirs
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("generated", exist_ok=True)
    os.makedirs("generated/images", exist_ok=True)
    os.makedirs("generated/documents", exist_ok=True)
    os.makedirs("generated/audio", exist_ok=True)

    yield

app = FastAPI(
    title="Private AI Agent",
    version="1.0.0",
    description="Your fully private, self-hosted AI assistant",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directories for generated files
app.mount("/generated", StaticFiles(directory="generated"), name="generated")

# Routers
app.include_router(chat.router,      prefix="/api/chat",      tags=["Chat"])
app.include_router(files.router,     prefix="/api/files",     tags=["Files"])
app.include_router(search.router,    prefix="/api/search",    tags=["Search"])
app.include_router(images.router,    prefix="/api/images",    tags=["Images"])
app.include_router(code.router,      prefix="/api/code",      tags=["Code"])
app.include_router(memory.router,    prefix="/api/memory",    tags=["Memory"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(voice.router,     prefix="/api/voice",     tags=["Voice"])
app.include_router(alerts.router,    prefix="/api/alerts",    tags=["Alerts"])
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["Knowledge Base"])

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
