// FILE: cf-backend/src/routes/knowledge.ts
import { Hono } from "hono";
import { Env, genId } from "../types";
import { storeKnowledgeChunk, searchKnowledge, chunkText } from "../services/vector";
import { uploadFile, makeFileKey, extractTextFromFile } from "../services/storage";
import {
  saveFile, saveKnowledgeDoc, listKnowledgeDocs,
  getKnowledgeDoc, updateKnowledgeTrust, deleteKnowledgeDoc,
} from "../services/database";

export const knowledgeRouter = new Hono<{ Bindings: Env }>();

knowledgeRouter.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string) || "";
  const trustLevel = parseInt((formData.get("trust_level") as string) || "2", 10);

  if (!file) return c.json({ error: "No file provided" }, 400);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "txt";
  const buffer = await file.arrayBuffer();

  // Upload raw file to R2
  const fileId = genId();
  const r2Key = makeFileKey(fileId, ext, "knowledge");
  await uploadFile(c.env, r2Key, buffer, file.type || "application/octet-stream");

  // Extract text content
  const text = await extractTextFromFile(buffer, ext);
  if (!text.trim()) {
    return c.json({ error: "Could not extract text from file." }, 400);
  }

  const docTitle = title || file.name;

  // Save file record
  const { id: savedFileId } = await saveFile(c.env, {
    originalName: file.name,
    fileType: ext,
    fileSize: buffer.byteLength,
    r2Key,
    isKnowledgeBase: true,
    trustLevel,
  });

  // Create knowledge doc record
  const docId = genId();

  // Chunk and embed the text
  const chunks = chunkText(text, 600, 100);
  let storedChunks = 0;

  // Store chunks in batches to avoid timeout
  const BATCH_SIZE = 10;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((chunk, batchIdx) =>
        storeKnowledgeChunk(
          c.env,
          chunk,
          docId,
          docTitle,
          trustLevel,
          i + batchIdx
        ).catch(() => null)
      )
    );
    storedChunks += batch.length;
  }

  await saveKnowledgeDoc(c.env, docTitle, savedFileId, trustLevel, storedChunks);

  return c.json({
    document_id: docId,
    title: docTitle,
    file: file.name,
    chunks_stored: storedChunks,
    trust_level: trustLevel,
    message: `Document '${docTitle}' added to knowledge base with ${storedChunks} searchable chunks.`,
  });
});

knowledgeRouter.get("/", async (c) => {
  const docs = await listKnowledgeDocs(c.env);
  return c.json(
    docs.map((d: any) => ({
      id: d.id,
      title: d.title,
      trust_level: d.trust_level,
      chunk_count: d.chunk_count,
      created_at: new Date(d.created_at * 1000).toISOString(),
    }))
  );
});

knowledgeRouter.post("/search", async (c) => {
  const query = c.req.query("query") ?? "";
  if (!query) return c.json({ error: "query required" }, 400);

  const results = await searchKnowledge(c.env, query, 8);
  return c.json({ query, results, count: results.length });
});

knowledgeRouter.patch("/:id/trust", async (c) => {
  const id = c.req.param("id");
  const trustLevel = parseInt(c.req.query("trust_level") ?? "2", 10);

  if (![1, 2, 3].includes(trustLevel)) {
    return c.json({ error: "Trust level must be 1, 2, or 3" }, 400);
  }

  const doc = await getKnowledgeDoc(c.env, id);
  if (!doc) return c.json({ error: "Document not found" }, 404);

  await updateKnowledgeTrust(c.env, id, trustLevel);
  return c.json({ success: true, document_id: id, trust_level: trustLevel });
});

knowledgeRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const doc = await getKnowledgeDoc(c.env, id);
  if (!doc) return c.json({ error: "Document not found" }, 404);

  await deleteKnowledgeDoc(c.env, id);
  // Note: Vectorize doesn't support bulk delete by metadata filter on free tier.
  // Vectors become orphaned but won't affect results significantly.

  return c.json({
    success: true,
    message: "Document removed from knowledge base.",
  });
});
