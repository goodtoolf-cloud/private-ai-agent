// FILE: cf-backend/src/routes/voice.ts
import { Hono } from "hono";
import { Env, genId } from "../types";
import { transcribeAudio, translateText } from "../services/ai";
import { uploadFile, makeGeneratedKey } from "../services/storage";

export const voiceRouter = new Hono<{ Bindings: Env }>();

voiceRouter.post("/transcribe", async (c) => {
  const formData = await c.req.formData();
  const audio = formData.get("audio") as File | null;
  if (!audio) return c.json({ error: "No audio file provided" }, 400);

  const buffer = await audio.arrayBuffer();
  const result = await transcribeAudio(c.env, buffer);

  return c.json({
    text: result.text,
    language: result.language ?? "en",
    language_probability: 1.0,
  });
});

voiceRouter.post("/speak", async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  if (!text) return c.json({ error: "text required" }, 400);

  // Cloudflare Workers AI has a basic TTS model
  // We use the AI binding's text-to-speech if available,
  // otherwise return the text for browser-side Web Speech API
  try {
    const response = await (c.env.AI as any).run("@cf/myshell-ai/melotts" as any, {
      prompt: text,
    });

    if (response && response instanceof ArrayBuffer) {
      const id = genId();
      const r2Key = makeGeneratedKey(id, "mp3", "audio");
      await uploadFile(c.env, r2Key, response, "audio/mpeg");
      const url = `/api/files/download/${encodeURIComponent(r2Key)}`;
      return c.json({ success: true, url, filename: `${id}.mp3` });
    }
  } catch {
    // TTS model not available — return signal for browser-side TTS
  }

  // Fallback: tell the frontend to use browser Web Speech API
  return c.json({
    success: true,
    url: null,
    filename: null,
    use_browser_tts: true,
    text,
  });
});

voiceRouter.post("/translate", async (c) => {
  const { text, target_lang, source_lang = "en" } = await c.req.json<{
    text: string;
    target_lang: string;
    source_lang?: string;
  }>();

  if (!text || !target_lang) return c.json({ error: "text and target_lang required" }, 400);

  const translated = await translateText(c.env, text, target_lang, source_lang);

  return c.json({
    success: true,
    translated_text: translated,
    source_language: source_lang,
    target_language: target_lang,
    engine: "Cloudflare M2M100",
  });
});
