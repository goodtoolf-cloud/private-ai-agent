// FILE: cf-backend/src/routes/images.ts
import { Hono } from "hono";
import { Env, genId } from "../types";
import { generateImage } from "../services/ai";
import { uploadFile, makeGeneratedKey } from "../services/storage";
import { saveGeneratedFile, listGeneratedFiles } from "../services/database";

export const imagesRouter = new Hono<{ Bindings: Env }>();

imagesRouter.post("/generate", async (c) => {
  const {
    prompt,
    negative_prompt = "blurry, low quality, distorted, ugly, watermark",
    steps = 20,
  } = await c.req.json<{ prompt: string; negative_prompt?: string; steps?: number }>();

  if (!prompt) return c.json({ error: "prompt required" }, 400);

  const imageBuffer = await generateImage(c.env, prompt, steps);

  const id = genId();
  const r2Key = makeGeneratedKey(id, "png", "images");

  await uploadFile(c.env, r2Key, imageBuffer, "image/png");

  const url = `/api/files/download/${encodeURIComponent(r2Key)}`;
  const filename = `${id}.png`;

  await saveGeneratedFile(c.env, filename, "png", prompt, r2Key);

  return c.json({ filename, url, prompt, width: 1024, height: 1024 });
});

imagesRouter.get("/", async (c) => {
  const images = await listGeneratedFiles(c.env, "png");
  return c.json(
    images.map((img: any) => ({
      id: img.id,
      url: `/api/files/download/${encodeURIComponent(img.r2_key)}`,
      description: img.description,
      created_at: new Date(img.created_at * 1000).toISOString(),
    }))
  );
});
