// FILE: cf-backend/src/services/ai.ts
// Cloudflare Workers AI — chat, embeddings, image generation, STT

import { Env, ModelKey, MODELS, ChatMessage } from "../types";

const SYSTEM_PROMPT = `You are a private AI assistant. You are helpful, thorough, and honest.

When answering:
- Break complex tasks into clear steps before executing.
- After every answer, assess your confidence and add at the end:
  [Confidence: XX% | Sources: N]
- If confidence is below 60%, warn the user before answering.
- Never fabricate facts. Say "I don't have reliable information on this" when unsure.
- For research: plan → gather → analyze → verify → answer.`;

export async function chatComplete(
  env: Env,
  messages: ChatMessage[],
  modelKey: ModelKey,
  systemPrompt = SYSTEM_PROMPT
): Promise<{ text: string; model: ModelKey }> {
  const modelId = MODELS[modelKey];
  const payload: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await env.AI.run(modelId as any, {
    messages: payload,
    max_tokens: 4096,
  } as any);

  const text = (response as any).response ?? (response as any).result?.response ?? "";
  return { text, model: modelKey };
}

export async function embedText(env: Env, text: string): Promise<number[]> {
  const response = await env.AI.run("@cf/baai/bge-small-en-v1.5" as any, {
    text: [text],
  } as any);
  return (response as any).data[0] as number[];
}

export async function generateImage(
  env: Env,
  prompt: string,
  steps = 8
): Promise<ArrayBuffer> {
  const response = await env.AI.run(
    "@cf/stabilityai/stable-diffusion-xl-base-1.0" as any,
    {
      prompt,
      negative_prompt: "blurry, low quality, distorted, ugly, watermark",
      num_steps: steps,
      width: 512,
      height: 512,
    } as any
  );
  return response as unknown as ArrayBuffer;
}

export async function transcribeAudio(
  env: Env,
  audioBuffer: ArrayBuffer
): Promise<{ text: string; language?: string }> {
  const response = await env.AI.run("@cf/openai/whisper" as any, {
    audio: [...new Uint8Array(audioBuffer)],
  } as any);
  return {
    text: (response as any).text ?? "",
    language: (response as any).language ?? "en",
  };
}

export async function translateText(
  env: Env,
  text: string,
  targetLang: string,
  sourceLang = "en"
): Promise<string> {
  const response = await env.AI.run("@cf/meta/m2m100-1.2b" as any, {
    text,
    source_lang: sourceLang,
    target_lang: targetLang,
  } as any);
  return (response as any).translated_text ?? text;
}

export function parseConfidence(text: string): number | undefined {
  const match = text.match(/\[Confidence:\s*(\d+)%/);
  return match ? parseInt(match[1]) : undefined;
}
