// FILE: cf-backend/src/routes/search.ts
import { Hono } from "hono";
import { Env } from "../types";
import { chatComplete } from "../services/ai";
import { searchWeb, fetchPageContent, researchTopic } from "../services/search";

export const searchRouter = new Hono<{ Bindings: Env }>();

searchRouter.post("/", async (c) => {
  const { query, num_results = 10 } = await c.req.json<{ query: string; num_results?: number }>();
  if (!query) return c.json({ error: "query required" }, 400);

  const results = await searchWeb(c.env, query, num_results);
  return c.json({ query, results, count: results.length });
});

searchRouter.post("/fetch", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url) return c.json({ error: "url required" }, 400);

  const content = await fetchPageContent(url);
  return c.json({ url, content, length: content.length });
});

searchRouter.post("/research", async (c) => {
  const { query, num_results = 5 } = await c.req.json<{ query: string; num_results?: number }>();
  if (!query) return c.json({ error: "query required" }, 400);

  const { sources } = await researchTopic(c.env, query, num_results);

  const sourcesText = sources
    .map((s, i) => `\n\n--- Source ${i + 1}: ${s.title} (${s.url}) ---\n${s.content}`)
    .join("");

  const prompt = `You are conducting deep research on: "${query}"

Sources gathered (${sources.length}):${sourcesText}

Please:
1. Synthesize all source information
2. Identify key findings and patterns
3. Note any conflicts between sources
4. Write a comprehensive, well-structured report
5. List all sources at the end
6. End with: [Confidence: XX% | Sources: ${sources.length}]`;

  const result = await chatComplete(
    c.env,
    [{ role: "user", content: prompt }],
    "deepseek"
  );

  return c.json({
    query,
    report: result.text,
    sources: sources.map((s) => ({ title: s.title, url: s.url })),
    source_count: sources.length,
    model_used: "deepseek",
  });
});
