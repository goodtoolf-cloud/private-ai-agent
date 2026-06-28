"""
FILE: backend/services/chroma_service.py
ChromaDB vector store for RAG memory and knowledge base.
"""

import chromadb
from chromadb.config import Settings as ChromaSettings
from services.cloudflare import embed_text
from config import get_settings
import uuid

settings = get_settings()

_client = None


def get_chroma_client() -> chromadb.AsyncHttpClient:
    global _client
    if _client is None:
        _client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def get_collection(name: str):
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


# ── Memory collection ──────────────────────────────────────────────────────────

async def store_memory_chunk(text: str, metadata: dict = {}) -> str:
    """Store a text chunk in the conversation memory collection."""
    collection = get_collection("memory")
    embedding = await embed_text(text)
    chunk_id = str(uuid.uuid4())
    collection.add(
        ids=[chunk_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[metadata],
    )
    return chunk_id


async def search_memory(query: str, n_results: int = 5) -> list[dict]:
    """Semantic search over conversation memory."""
    collection = get_collection("memory")
    embedding = await embed_text(query)
    results = collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
    )
    return _format_results(results)


# ── Knowledge base collection ──────────────────────────────────────────────────

async def store_knowledge_chunk(
    text: str,
    document_id: str,
    document_title: str,
    trust_level: int = 2,
    chunk_index: int = 0,
) -> str:
    """Store a chunk from a knowledge base document."""
    collection = get_collection("knowledge")
    embedding = await embed_text(text)
    chunk_id = str(uuid.uuid4())
    collection.add(
        ids=[chunk_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[{
            "document_id": document_id,
            "document_title": document_title,
            "trust_level": trust_level,
            "chunk_index": chunk_index,
        }],
    )
    return chunk_id


async def search_knowledge(query: str, n_results: int = 8) -> list[dict]:
    """Semantic search over the knowledge base."""
    collection = get_collection("knowledge")
    embedding = await embed_text(query)
    results = collection.query(
        query_embeddings=[embedding],
        n_results=n_results,
    )
    return _format_results(results)


async def delete_document_chunks(document_id: str) -> None:
    """Remove all chunks for a given document from knowledge base."""
    collection = get_collection("knowledge")
    # Get all chunks for this document
    existing = collection.get(where={"document_id": document_id})
    if existing["ids"]:
        collection.delete(ids=existing["ids"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _format_results(results: dict) -> list[dict]:
    formatted = []
    if not results or not results.get("documents"):
        return formatted
    docs = results["documents"][0]
    metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
    distances = results["distances"][0] if results.get("distances") else [0] * len(docs)
    ids = results["ids"][0] if results.get("ids") else [""] * len(docs)
    for doc, meta, dist, cid in zip(docs, metas, distances, ids):
        formatted.append({
            "id": cid,
            "text": doc,
            "metadata": meta,
            "similarity": round(1 - dist, 4),
        })
    return formatted


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    """Split text into overlapping chunks for embedding."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks
