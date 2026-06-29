// FILE: cf-backend/src/services/database.ts
// D1 database helpers — thin wrappers for clean query code

import { Env, genId } from "../types";

// ── Conversations ─────────────────────────────────────────────────────────────

export async function createConversation(env: Env, modelUsed = "auto") {
  const id = genId();
  await env.DB.prepare(
    "INSERT INTO conversations (id, model_used) VALUES (?, ?)"
  ).bind(id, modelUsed).run();
  return id;
}

export async function updateConversationTitle(env: Env, id: string, title: string) {
  await env.DB.prepare(
    "UPDATE conversations SET title = ?, updated_at = unixepoch() WHERE id = ?"
  ).bind(title.slice(0, 80), id).run();
}

export async function getConversation(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM conversations WHERE id = ?")
    .bind(id).first();
}

export async function listConversations(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50"
  ).all();
  return results;
}

export async function deleteConversation(env: Env, id: string) {
  await env.DB.prepare("DELETE FROM conversations WHERE id = ?").bind(id).run();
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function saveMessage(
  env: Env,
  conversationId: string,
  role: string,
  content: string,
  modelUsed?: string,
  confidence?: number,
  sourcesCount = 0
) {
  const id = genId();
  await env.DB.prepare(
    `INSERT INTO messages
       (id, conversation_id, role, content, model_used, confidence, sources_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, conversationId, role, content, modelUsed ?? null, confidence ?? null, sourcesCount).run();
  return id;
}

export async function getMessages(env: Env, conversationId: string, limit = 20) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?"
  ).bind(conversationId, limit).all();
  return results;
}

// ── Files ─────────────────────────────────────────────────────────────────────

export async function saveFile(
  env: Env,
  data: {
    originalName: string;
    fileType: string;
    fileSize: number;
    r2Key: string;
    contentSummary?: string;
    isKnowledgeBase?: boolean;
    trustLevel?: number;
  }
) {
  const id = genId();
  const filename = `${id}.${data.fileType}`;
  await env.DB.prepare(
    `INSERT INTO uploaded_files
       (id, filename, original_name, file_type, file_size, r2_key, content_summary, is_knowledge_base, trust_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, filename, data.originalName, data.fileType, data.fileSize,
    data.r2Key, data.contentSummary ?? null,
    data.isKnowledgeBase ? 1 : 0, data.trustLevel ?? 2
  ).run();
  return { id, filename };
}

export async function listFiles(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM uploaded_files ORDER BY created_at DESC LIMIT 100"
  ).all();
  return results;
}

export async function getFile(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM uploaded_files WHERE id = ?").bind(id).first();
}

export async function deleteFile(env: Env, id: string) {
  await env.DB.prepare("DELETE FROM uploaded_files WHERE id = ?").bind(id).run();
}

// ── Memory ────────────────────────────────────────────────────────────────────

export async function upsertMemory(env: Env, key: string, value: string, category = "general") {
  const id = genId();
  await env.DB.prepare(
    `INSERT INTO user_memories (id, key, value, category)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category, last_updated = unixepoch()`
  ).bind(id, key, value, category).run();
}

export async function listMemories(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM user_memories ORDER BY category ASC, last_updated DESC"
  ).all();
  return results;
}

export async function deleteMemory(env: Env, id: string) {
  await env.DB.prepare("DELETE FROM user_memories WHERE id = ?").bind(id).run();
}

export async function clearMemories(env: Env) {
  await env.DB.prepare("DELETE FROM user_memories").run();
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

export async function saveKnowledgeDoc(
  env: Env,
  title: string,
  fileId: string | null,
  trustLevel: number,
  chunkCount: number
) {
  const id = genId();
  await env.DB.prepare(
    "INSERT INTO knowledge_documents (id, title, file_id, trust_level, chunk_count) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, title, fileId, trustLevel, chunkCount).run();
  return id;
}

export async function listKnowledgeDocs(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM knowledge_documents ORDER BY created_at DESC"
  ).all();
  return results;
}

export async function getKnowledgeDoc(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM knowledge_documents WHERE id = ?").bind(id).first();
}

export async function updateKnowledgeTrust(env: Env, id: string, trustLevel: number) {
  await env.DB.prepare(
    "UPDATE knowledge_documents SET trust_level = ? WHERE id = ?"
  ).bind(trustLevel, id).run();
}

export async function deleteKnowledgeDoc(env: Env, id: string) {
  await env.DB.prepare("DELETE FROM knowledge_documents WHERE id = ?").bind(id).run();
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export async function createAlert(env: Env, topic: string, query: string, intervalMinutes: number) {
  const id = genId();
  await env.DB.prepare(
    "INSERT INTO monitor_alerts (id, topic, query, interval_minutes) VALUES (?, ?, ?, ?)"
  ).bind(id, topic, query, intervalMinutes).run();
  return id;
}

export async function listAlerts(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM monitor_alerts ORDER BY created_at DESC"
  ).all();
  return results;
}

export async function getAlert(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM monitor_alerts WHERE id = ?").bind(id).first();
}

export async function updateAlertCheck(env: Env, id: string, lastResult: string) {
  await env.DB.prepare(
    "UPDATE monitor_alerts SET last_check = unixepoch(), last_result = ? WHERE id = ?"
  ).bind(lastResult.slice(0, 2000), id).run();
}

export async function deleteAlert(env: Env, id: string) {
  await env.DB.prepare("DELETE FROM monitor_alerts WHERE id = ?").bind(id).run();
}

export async function createNotification(env: Env, alertId: string, summary: string) {
  const id = genId();
  await env.DB.prepare(
    "INSERT INTO alert_notifications (id, alert_id, summary) VALUES (?, ?, ?)"
  ).bind(id, alertId, summary).run();
  return id;
}

export async function listNotifications(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM alert_notifications ORDER BY created_at DESC LIMIT 50"
  ).all();
  return results;
}

export async function markNotificationRead(env: Env, id: string) {
  await env.DB.prepare(
    "UPDATE alert_notifications SET is_read = 1 WHERE id = ?"
  ).bind(id).run();
}

// ── Generated files ───────────────────────────────────────────────────────────

export async function saveGeneratedFile(
  env: Env,
  filename: string,
  fileType: string,
  description: string,
  r2Key: string
) {
  const id = genId();
  await env.DB.prepare(
    "INSERT INTO generated_files (id, filename, file_type, description, r2_key) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, filename, fileType, description, r2Key).run();
  return id;
}

export async function listGeneratedFiles(env: Env, fileType?: string) {
  if (fileType) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM generated_files WHERE file_type = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(fileType).all();
    return results;
  }
  const { results } = await env.DB.prepare(
    "SELECT * FROM generated_files ORDER BY created_at DESC LIMIT 100"
  ).all();
  return results;
}
