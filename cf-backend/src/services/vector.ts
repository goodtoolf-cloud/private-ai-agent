// FILE: cf-backend/src/services/vector.ts
// Cloudflare Vectorize helpers for memory and knowledge base RAG

import { Env, VectorChunk, genId } from "../types";
import { embedText } from "./ai";

// ── Memory ────────────────────────────────────────────────────────────────────

export async function storeMemoryChunk(
  env: Env,
  text: string,
  metadata: Record<string, string | number> = {}
): Promise<string> {
  const id = genId();
  const embedding = await embedText(env, text);

  await env.VECTORIZE_MEMORY.upsert([{
    id,
    values: embedding,
    metadata: { text: text.slice(0, 512), ...metadata },
  }]);

  return id;
}

export async function searchMemory(
  env: Env,
  query: string,
  topK = 5
): Promise<VectorChunk[]> {
  const embedding = await embedText(env, query);
  const results = await env.VECTORIZE_MEMORY.query(embedding, {
    topK,
    returnMetadata: "all",
  });

  return (results.matches ?? []).map((m) => ({
    id: m.id,
    text: (m.metadata?.text as string) ?? "",
    metadata: (m.metadata ?? {}) as Record<string, string | number>,
    similarity: m.score,
  }));
}

// ── Knowledge base ────────────────────────────────────────────────────────────

export async function storeKnowledgeChunk(
  env: Env,
  text: string,
  documentId: string,
  documentTitle: string,
  trustLevel: number,
  chunkIndex: number
): Promise<string> {
  const id = genId();
  const embedding = await embedText(env, text);

  await env.VECTORIZE_KNOWLEDGE.upsert([{
    id,
    values: embedding,
    metadata: {
      text: text.slice(0, 512),
      document_id: documentId,
      document_title: documentTitle,
      trust_level: trustLevel,
      chunk_index: chunkIndex,
    },
  }]);

  return id;
}

export async function searchKnowledge(
  env: Env,
  query: string,
  topK = 8
): Promise<VectorChunk[]> {
  const embedding = await embedText(env, query);
  const results = await env.VECTORIZE_KNOWLEDGE.query(embedding, {
    topK,
    returnMetadata: "all",
  });

  return (results.matches ?? []).map((m) => ({
    id: m.id,
    text: (m.metadata?.text as string) ?? "",
    metadata: (m.metadata ?? {}) as Record<string, string | number>,
    similarity: m.score,
  }));
}

// ── Text chunking ─────────────────────────────────────────────────────────────

export function chunkText(text: string, chunkSize = 600, overlap = 100): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk);
    i += chunkSize - overlap;
  }
  return chunks;
}
