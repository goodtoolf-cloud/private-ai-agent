// FILE: cf-backend/src/services/storage.ts
// R2 object storage helpers

import { Env } from "../types";

export async function uploadFile(
  env: Env,
  key: string,
  data: ArrayBuffer | ReadableStream | string,
  contentType: string
): Promise<void> {
  await env.STORAGE.put(key, data, {
    httpMetadata: { contentType },
  });
}

export async function getFile(env: Env, key: string): Promise<R2ObjectBody | null> {
  return env.STORAGE.get(key);
}

export async function deleteFile(env: Env, key: string): Promise<void> {
  await env.STORAGE.delete(key);
}

export async function getFileAsText(env: Env, key: string): Promise<string> {
  const obj = await env.STORAGE.get(key);
  if (!obj) return "";
  return obj.text();
}

export async function getFileAsArrayBuffer(env: Env, key: string): Promise<ArrayBuffer | null> {
  const obj = await env.STORAGE.get(key);
  if (!obj) return null;
  return obj.arrayBuffer();
}

export function getPublicUrl(key: string): string {
  return `/api/files/download/${encodeURIComponent(key)}`;
}

export function makeFileKey(id: string, ext: string, folder = "uploads"): string {
  return `${folder}/${id}.${ext}`;
}

export function makeGeneratedKey(id: string, ext: string, folder = "generated"): string {
  return `${folder}/${id}.${ext}`;
}

// Extract text from common file types (Workers-compatible)
export async function extractTextFromFile(
  buffer: ArrayBuffer,
  fileType: string
): Promise<string> {
  const ext = fileType.toLowerCase();

  if (["txt", "md", "json", "xml", "html", "py", "js", "ts", "csv", "yaml", "yml"].includes(ext)) {
    return new TextDecoder().decode(buffer);
  }

  if (ext === "csv") {
    return new TextDecoder().decode(buffer);
  }

  // For binary formats (PDF, DOCX, XLSX) — extract what text we can
  // A full parser isn't available in Workers, so we return the raw bytes
  // converted to text (partial, for AI to analyse)
  if (ext === "pdf") {
    const text = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true }).decode(buffer);
    // Extract readable strings from PDF raw bytes
    const readable = text
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return readable.slice(0, 8000);
  }

  // For DOCX / XLSX (ZIP-based): extract XML text content
  if (["docx", "xlsx"].includes(ext)) {
    const text = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true }).decode(buffer);
    // Pull text between XML tags
    const matches = text.match(/>([^<]{3,})</g) ?? [];
    const content = matches
      .map((m) => m.replace(/^>|<$/g, "").trim())
      .filter((m) => m.length > 3)
      .join(" ");
    return content.slice(0, 8000);
  }

  return `[Binary file: ${fileType.toUpperCase()} — ${buffer.byteLength} bytes]`;
}
