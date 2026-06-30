// FILE: cf-backend/src/routes/chat.ts
import { Hono } from "hono";
import { Env, autoSelectModel, modelCanHandle, ChatMessage } from "../types";
import { chatComplete, parseConfidence } from "../services/ai";
import { searchMemory, searchKnowledge, storeMemoryChunk } from "../services/vector";
import {
  createConversation, updateConversationTitle,
  getConversation, listConversations, deleteConversation,
  saveMessage, getMessages,
} from "../services/database";

export const chatRouter = new Hono<{ Bindings: Env }>();

const SYSTEM_PROMPT = `You are a private AI assistant. Be helpful, thorough, and honest.

Rules:
- Break complex tasks into clear steps before executing.
- End every answer with: [Confidence: XX% | Sources: N]
- If confidence < 60%, warn the user first.
- Never fabricate facts. Say you don't know rather than guess.
- For research tasks: plan → gather → analyze → verify → answer.`;

chatRouter.post("", async (c) => {
  const body = await c.req.json<{
    message: string;
    conversation_id?: string;
    model?: string;
    has_file?: boolean;
    file_type?: string;
  }>();

  const { message, model = "auto", has_file = false, file_type = "" } = body;

  // 1. Model selection
  let modelKey = model === "auto"
    ? autoSelectModel(message, has_file, file_type)
    : (model as any);
  let warning: string | undefined;

  if (model !== "auto") {
    const check = modelCanHandle(modelKey, has_file);
    if (!check.ok) {
      warning = check.warning;
      modelKey = autoSelectModel(message, has_file, file_type);
    }
  }

  // 2. Get/create conversation
  let convId = body.conversation_id;
  if (convId) {
    const conv = await getConversation(c.env, convId);
    if (!conv) return c.json({ error: "Conversation not found" }, 404);
  } else {
    convId = await createConversation(c.env, modelKey);
  }

  // 3. Load history
  const history = await getMessages(c.env, convId, 20);
  const messages: ChatMessage[] = history.map((m: any) => ({
    role: m.role,
    content: m.content,
  }));

  // 4. RAG context — memory + knowledge base (parallel)
  const [memChunks, knowChunks] = await Promise.all([
    searchMemory(c.env, message, 3).catch(() => []),
    searchKnowledge(c.env, message, 5).catch(() => []),
  ]);

  let userContent = message;
  const contextParts: string[] = [];

  if (memChunks.length > 0) {
    contextParts.push(
      "[What I remember about you]\n" +
      memChunks.map((c) => c.text).join("\n")
    );
  }
  if (knowChunks.length > 0) {
    contextParts.push(
      "[Relevant knowledge]\n" +
      knowChunks
        .map((k) => `[${k.metadata.document_title} | Trust: ${k.metadata.trust_level}/3]\n${k.text}`)
        .join("\n\n")
    );
  }
  if (contextParts.length > 0) {
    userContent = contextParts.join("\n\n") + "\n\n[User message]\n" + message;
  }

  messages.push({ role: "user", content: userContent });

  // 5. AI call
  const result = await chatComplete(c.env, messages, modelKey, SYSTEM_PROMPT);
  const confidence = parseConfidence(result.text);
  const sourcesCount = knowChunks.length;

  // 6. Save to D1
  await Promise.all([
    saveMessage(c.env, convId, "user", message),
    saveMessage(c.env, convId, "assistant", result.text, modelKey, confidence, sourcesCount),
  ]);

  // 7. Update conversation title if new
  if (!body.conversation_id && message) {
    await updateConversationTitle(c.env, convId, message.slice(0, 60));
  }

  // 8. Store in memory vector store (fire and forget)
  storeMemoryChunk(
    c.env,
    `User: ${message.slice(0, 200)}\nAssistant: ${result.text.slice(0, 400)}`,
    { conversation_id: convId, model: modelKey }
  ).catch(() => {});

  return c.json({
    reply: result.text,
    model_used: modelKey,
    conversation_id: convId,
    confidence: confidence ?? null,
    sources_count: sourcesCount,
    warning: warning ?? null,
  });
});

chatRouter.get("/conversations", async (c) => {
  const convs = await listConversations(c.env);
  return c.json(
    convs.map((conv: any) => ({
      id: conv.id,
      title: conv.title ?? "Untitled",
      model_used: conv.model_used,
      created_at: new Date(conv.created_at * 1000).toISOString(),
      updated_at: new Date(conv.updated_at * 1000).toISOString(),
    }))
  );
});

chatRouter.get("/conversations/:id/messages", async (c) => {
  const id = c.req.param("id");
  const msgs = await getMessages(c.env, id);
  return c.json(
    msgs.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model_used: m.model_used,
      confidence: m.confidence,
      created_at: new Date(m.created_at * 1000).toISOString(),
    }))
  );
});

chatRouter.delete("/conversations/:id", async (c) => {
  await deleteConversation(c.env, c.req.param("id"));
  return c.json({ success: true });
});
