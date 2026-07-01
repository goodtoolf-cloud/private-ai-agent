// FILE: cf-backend/src/index.ts
// Main Cloudflare Worker entry point — Hono router + scheduled cron

import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";

import { chatRouter }      from "./routes/chat";
import { filesRouter }     from "./routes/files";
import { searchRouter }    from "./routes/search";
import { imagesRouter }    from "./routes/images";
import { codeRouter }      from "./routes/code";
import { documentsRouter } from "./routes/documents";
import { voiceRouter }     from "./routes/voice";
import { memoryRouter }    from "./routes/memory";
import { alertsRouter, runScheduledAlertChecks } from "./routes/alerts";
import { knowledgeRouter } from "./routes/knowledge";

const app = new Hono<{ Bindings: Env }>();

// Global CORS — allows the Cloudflare Pages frontend to call this worker
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// Health check
app.get("/api/health", (c) =>
  c.json({ status: "ok", version: "1.0.0", runtime: "Cloudflare Workers" })
);
app.post("/api/test", (c) => c.json({ ok: true }));

// Mount all routers
app.route("/api/chat",      chatRouter);
app.route("/api/files",     filesRouter);
app.route("/api/search",    searchRouter);
app.route("/api/images",    imagesRouter);
app.route("/api/code",      codeRouter);
app.route("/api/documents", documentsRouter);
app.route("/api/voice",     voiceRouter);
app.route("/api/memory",    memoryRouter);
app.route("/api/alerts",    alertsRouter);
app.route("/api/knowledge", knowledgeRouter);

// 404 fallback
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Worker error:", err);
  return c.json({ error: err.message ?? "Internal server error" }, 500);
});

// Export default with scheduled handler for cron jobs
export default {
  fetch: app.fetch,

  // Cron trigger — runs every hour to check monitoring alerts
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    await runScheduledAlertChecks(env);
  },
};
