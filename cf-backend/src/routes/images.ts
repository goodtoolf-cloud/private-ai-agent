// FILE: cf-backend/src/routes/images.ts
import { Hono } from "hono";
import { Env } from "../types";
import { generateImage } from "../services/ai";

export const imagesRouter = new Hono<{ Bindings: Env }>();

imagesRouter.post("/generate", async (c) => {
  const {
    prompt,
    negative_prompt = "blurry, low quality, distorted, ugly, watermark",
    steps = 20,
  } = await c.req.json<{ prompt: string; negative_prompt?: string; steps?: number }>();

  if (!prompt) return c.json({ error: "prompt required" }, 400);

  const imageBuffer = await generateImage(c.env, prompt, steps);
  const bytes = new Uint8Array(imageBuffer);
let binary = "";
for (let i = 0; i < bytes.byteLength; i++) {
  binary += String.fromCharCode(bytes[i]);
}
const base64 = btoa(binary);
  const url = `data:image/png;base64,${base64}`;

  return c.json({ url, prompt, width: 1024, height: 1024 });
});

imagesRouter.get("/", async (c) => {
  return c.json([]);
});
