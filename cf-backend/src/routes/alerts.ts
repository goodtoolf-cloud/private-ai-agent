// FILE: cf-backend/src/routes/alerts.ts
import { Hono } from "hono";
import { Env } from "../types";
import { chatComplete } from "../services/ai";
import { searchWeb } from "../services/search";
import {
  createAlert, listAlerts, getAlert, updateAlertCheck, deleteAlert,
  createNotification, listNotifications, markNotificationRead,
} from "../services/database";

export const alertsRouter = new Hono<{ Bindings: Env }>();

alertsRouter.post("/", async (c) => {
  const { topic, query, interval_minutes = 60 } = await c.req.json<{
    topic: string;
    query: string;
    interval_minutes?: number;
  }>();

  if (!topic || !query) return c.json({ error: "topic and query required" }, 400);

  const id = await createAlert(c.env, topic, query, interval_minutes);
  return c.json({ id, topic, message: "Alert created. Monitoring started." });
});

alertsRouter.get("/", async (c) => {
  const alerts = await listAlerts(c.env);
  return c.json(
    alerts.map((a: any) => ({
      id: a.id,
      topic: a.topic,
      query: a.query,
      interval_minutes: a.interval_minutes,
      is_active: Boolean(a.is_active),
      last_check: a.last_check ? new Date(a.last_check * 1000).toISOString() : null,
      created_at: new Date(a.created_at * 1000).toISOString(),
    }))
  );
});

alertsRouter.post("/:id/check", async (c) => {
  const id = c.req.param("id");
  const alert = await getAlert(c.env, id);
  if (!alert) return c.json({ error: "Alert not found" }, 404);

  const a = alert as any;

  // Search for latest info
  const results = await searchWeb(c.env, a.query, 5);
  const resultsText = results
    .filter((r) => r.title)
    .map((r) => `- ${r.title}: ${r.content.slice(0, 200)}`)
    .join("\n");

  const prompt = `I'm monitoring the topic: "${a.topic}"
Search query: "${a.query}"

Latest search results:
${resultsText}

Previous check result:
${a.last_result ?? "No previous check"}

Task:
1. Summarize what is NEW or CHANGED since the last check
2. Flag anything important
3. Keep it concise — 3 to 5 bullet points maximum
If nothing has changed, say so clearly.`;

  const result = await chatComplete(
    c.env,
    [{ role: "user", content: prompt }],
    "llama"
  );

  await updateAlertCheck(c.env, id, resultsText);
  await createNotification(c.env, id, result.text);

  return c.json({
    alert_id: id,
    topic: a.topic,
    summary: result.text,
    sources_checked: results.length,
  });
});

alertsRouter.get("/notifications", async (c) => {
  const notifications = await listNotifications(c.env);
  return c.json(
    notifications.map((n: any) => ({
      id: n.id,
      alert_id: n.alert_id,
      summary: n.summary,
      is_read: Boolean(n.is_read),
      created_at: new Date(n.created_at * 1000).toISOString(),
    }))
  );
});

alertsRouter.patch("/notifications/:id/read", async (c) => {
  await markNotificationRead(c.env, c.req.param("id"));
  return c.json({ success: true });
});

alertsRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const alert = await getAlert(c.env, id);
  if (!alert) return c.json({ error: "Alert not found" }, 404);
  await deleteAlert(c.env, id);
  return c.json({ success: true });
});

// Called by the cron trigger in wrangler.toml (runs every hour)
export async function runScheduledAlertChecks(env: Env): Promise<void> {
  const alerts = await listAlerts(env);
  const now = Math.floor(Date.now() / 1000);

  for (const alert of alerts as any[]) {
    if (!alert.is_active) continue;

    const nextCheckAt = (alert.last_check ?? 0) + alert.interval_minutes * 60;
    if (now < nextCheckAt) continue;

    try {
      const results = await searchWeb(env, alert.query, 5);
      const resultsText = results
        .filter((r) => r.title)
        .map((r) => `- ${r.title}: ${r.content.slice(0, 150)}`)
        .join("\n");

      const prompt = `Monitoring topic: "${alert.topic}"
Latest results:
${resultsText}

Previous: ${alert.last_result ?? "none"}

Summarize what changed in 3 bullet points. If nothing changed, say "No significant changes."`;

      const result = await chatComplete(
        env,
        [{ role: "user", content: prompt }],
        "llama"
      );

      if (!result.text.toLowerCase().includes("no significant changes")) {
        await createNotification(env, alert.id, result.text);
      }
      await updateAlertCheck(env, alert.id, resultsText);
    } catch {
      // Skip failed alerts silently
    }
  }
}
