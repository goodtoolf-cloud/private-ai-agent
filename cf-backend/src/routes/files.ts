// FILE: cf-backend/src/routes/files.ts
import { Hono } from "hono";
import { Env, autoSelectModel, genId } from "../types";
import { chatComplete } from "../services/ai";
import { uploadFile, deleteFile as deleteR2File, makeFileKey, getPublicUrl, extractTextFromFile } from "../services/storage";
import { saveFile, listFiles, getFile, deleteFile as deleteDbFile } from "../services/database";

export const filesRouter = new Hono<{ Bindings: Env }>();

const ALLOWED_TYPES = new Set([
  "pdf", "docx", "doc", "xlsx", "xls", "csv",
  "png", "jpg", "jpeg", "gif", "webp",
  "mp3", "wav", "m4a", "ogg", "webm", "mp4",
  "txt", "md", "json", "xml", "py", "js", "ts",
]);

filesRouter.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const question = (formData.get("question") as string) || "Analyze and summarize this file.";

  if (!file) return c.json({ error: "No file provided" }, 400);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  if (!ALLOWED_TYPES.has(ext)) {
    return c.json({ error: `File type .${ext} not supported` }, 400);
  }

  const buffer = await file.arrayBuffer();
  const fileId = genId();
  const r2Key = makeFileKey(fileId, ext);

  // Upload to R2
  await uploadFile(c.env, r2Key, buffer, file.type || "application/octet-stream");

  // Extract text
  const extractedText = await extractTextFromFile(buffer, ext);

  // AI analysis
  const modelKey = autoSelectModel(question, true, ext);
  const prompt = `[File: ${file.name} | Type: ${ext.toUpperCase()} | Size: ${buffer.byteLength} bytes]

Extracted content:
${extractedText.slice(0, 5000)}

User question: ${question}`;

  const result = await chatComplete(
    c.env,
    [{ role: "user", content: prompt }],
    modelKey
  );

  // Save to D1
  const { id } = await saveFile(c.env, {
    originalName: file.name,
    fileType: ext,
    fileSize: buffer.byteLength,
    r2Key,
    contentSummary: result.text.slice(0, 1000),
    isKnowledgeBase: false,
  });

  return c.json({
    file_id: id,
    filename: file.name,
    file_type: ext,
    file_size: buffer.byteLength,
    parsed_text_length: extractedText.length,
    analysis: result.text,
    model_used: modelKey,
  });
});

filesRouter.get("/", async (c) => {
  const files = await listFiles(c.env);
  return c.json(
    files.map((f: any) => ({
      id: f.id,
      original_name: f.original_name,
      file_type: f.file_type,
      file_size: f.file_size,
      content_summary: f.content_summary,
      is_knowledge_base: Boolean(f.is_knowledge_base),
      created_at: new Date(f.created_at * 1000).toISOString(),
    }))
  );
});

// Serve file from R2
filesRouter.get("/download/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  const obj = await c.env.STORAGE.get(key);
  if (!obj) return c.json({ error: "File not found" }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=86400");

  return new Response(obj.body, { headers });
});

filesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const file = await getFile(c.env, id);
  if (!file) return c.json({ error: "File not found" }, 404);

  await Promise.all([
    deleteR2File(c.env, (file as any).r2_key),
    deleteDbFile(c.env, id),
  ]);

  return c.json({ success: true });
});
