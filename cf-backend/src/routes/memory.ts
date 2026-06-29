// FILE: cf-backend/src/routes/memory.ts
import { Hono } from "hono";
import { Env } from "../types";
import { storeMemoryChunk, searchMemory } from "../services/vector";
import { upsertMemory, listMemories, deleteMemory, clearMemories } from "../services/database";

export const memoryRouter = new Hono<{ Bindings: Env }>();

memoryRouter.post("/", async (c) => {
  const { key, value, category = "general" } = await c.req.json<{
    key: string;
    value: string;
    category?: string;
  }>();

  if (!key || !value) return c.json({ error: "key and value required" }, 400);

  await upsertMemory(c.env, key, value, category);

  // Also store in vector DB for semantic search
  await storeMemoryChunk(
    c.env,
    `${key}: ${value}`,
    { key, category, type: "user_memory" }
  ).catch(() => {});

  return c.json({ success: true, key });
});

memoryRouter.get("/", async (c) => {
  const memories = await listMemories(c.env);
  return c.json(
    memories.map((m: any) => ({
      id: m.id,
      key: m.key,
      value: m.value,
      category: m.category,
      last_updated: new Date(m.last_updated * 1000).toISOString(),
    }))
  );
});

memoryRouter.post("/search", async (c) => {
  const { query, n_results = 5 } = await c.req.json<{ query: string; n_results?: number }>();
  if (!query) return c.json({ error: "query required" }, 400);

  const results = await searchMemory(c.env, query, n_results);
  return c.json({ query, results });
});

memoryRouter.delete("/", async (c) => {
  await clearMemories(c.env);
  return c.json({ success: true, message: "All memories cleared" });
});

memoryRouter.delete("/:id", async (c) => {
  await deleteMemory(c.env, c.req.param("id"));
  return c.json({ success: true });
});
