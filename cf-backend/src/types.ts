// FILE: cf-backend/src/types.ts
// All TypeScript types and the Cloudflare env interface

export interface Env {
  // Cloudflare AI
  AI: Ai;

  // D1 SQL database
  DB: D1Database;

  // R2 object storage
  STORAGE: R2Bucket;

  // Vectorize indexes
  VECTORIZE_MEMORY: VectorizeIndex;
  VECTORIZE_KNOWLEDGE: VectorizeIndex;

  // KV cache
  CACHE: KVNamespace;

  // Environment variables
  SEARXNG_URL: string;
  E2B_API_KEY: string;
  ENVIRONMENT: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  model?: string;
  stream?: boolean;
  has_file?: boolean;
  file_type?: string;
}

export interface ChatResponse {
  reply: string;
  model_used: string;
  conversation_id: string;
  confidence?: number;
  sources_count: number;
  warning?: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  model_used: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  model_used?: string;
  confidence?: number;
  sources_count?: number;
  created_at: number;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
}

export interface VectorChunk {
  id: string;
  text: string;
  metadata: Record<string, string | number>;
  similarity?: number;
}

export type ModelKey = "deepseek" | "llama" | "gemini";

export const MODELS: Record<ModelKey, string> = {
  deepseek: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  llama:    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  gemini:   "@cf/google/gemma-7b-it-lora",
};

export const TASK_KEYWORDS: Record<ModelKey, string[]> = {
  deepseek: [
    "research", "analyze", "analyse", "compare", "explain", "calculate",
    "solve", "equation", "math", "science", "code", "debug", "proof",
    "derive", "complex", "step by step", "why", "how does",
  ],
  gemini: [
    "image", "photo", "picture", "pdf", "excel", "spreadsheet", "word",
    "document", "audio", "video", "file", "upload", "scan",
  ],
  llama: [
    "translate", "summarize", "summary", "quick", "simple", "what is",
    "define", "list", "short", "tldr", "hello", "hi",
  ],
};

export function autoSelectModel(
  message: string,
  hasFile = false,
  fileType = ""
): ModelKey {
  if (hasFile || ["pdf", "image", "audio", "video", "xlsx", "docx"].includes(fileType)) {
    return "gemini";
  }
  const lower = message.toLowerCase();
  for (const kw of TASK_KEYWORDS.deepseek) {
    if (lower.includes(kw)) return "deepseek";
  }
  for (const kw of TASK_KEYWORDS.gemini) {
    if (lower.includes(kw)) return "gemini";
  }
  for (const kw of TASK_KEYWORDS.llama) {
    if (lower.includes(kw)) return "llama";
  }
  return "llama";
}

export function modelCanHandle(
  model: ModelKey,
  hasFile: boolean
): { ok: boolean; warning?: string } {
  if (hasFile && model !== "gemini") {
    return {
      ok: false,
      warning: `Files require Gemini Flash. Switched automatically from ${model}.`,
    };
  }
  return { ok: true };
}

export function genId(): string {
  return crypto.randomUUID();
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
