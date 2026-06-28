// FILE: frontend/src/pages/ImagesPage.tsx
import { useState } from "react";
import { Image, Wand2, Loader2, Download } from "lucide-react";
import { imagesAPI } from "../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function ImagesPage() {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("blurry, low quality, distorted, ugly, watermark");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const { data: images = [] } = useQuery({
    queryKey: ["images"],
    queryFn: () => imagesAPI.list().then((r) => r.data),
  });

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setLastGenerated(null);
    try {
      const res = await imagesAPI.generate({
        prompt,
        negative_prompt: negativePrompt,
        width,
        height,
        steps: 20,
      });
      setLastGenerated(res.data.url);
      qc.invalidateQueries({ queryKey: ["images"] });
    } catch (err: any) {
      alert("Generation failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Image Generation</h1>
        <p className="text-sm text-slate-400 mt-1">Describe any image — generated locally using Stable Diffusion via Cloudflare.</p>
      </div>

      {/* Prompt */}
      <div className="space-y-3">
        <div>
          <label className="text-sm text-slate-400 mb-1.5 block">Prompt</label>
          <textarea
            className="input"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A cyberpunk city at night, neon reflections on rain-soaked streets, cinematic lighting..."
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1.5 block">Negative prompt (what to avoid)</label>
          <input
            className="input"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm text-slate-400 mb-1.5 block">Width</label>
            <select className="input" value={width} onChange={(e) => setWidth(Number(e.target.value))}>
              <option value={512}>512</option>
              <option value={768}>768</option>
              <option value={1024}>1024</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm text-slate-400 mb-1.5 block">Height</label>
            <select className="input" value={height} onChange={(e) => setHeight(Number(e.target.value))}>
              <option value={512}>512</option>
              <option value={768}>768</option>
              <option value={1024}>1024</option>
            </select>
          </div>
        </div>

        <button onClick={generate} disabled={generating || !prompt.trim()} className="btn-primary flex items-center gap-2">
          {generating ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
          {generating ? "Generating... (30-60s)" : "Generate Image"}
        </button>
      </div>

      {/* Latest generated */}
      {lastGenerated && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Generated Image</h3>
            <a href={lastGenerated} download className="btn-ghost flex items-center gap-1 text-xs">
              <Download size={14} /> Download
            </a>
          </div>
          <img src={lastGenerated} alt="Generated" className="w-full rounded-lg" />
          <p className="text-xs text-slate-500">{prompt}</p>
        </div>
      )}

      {/* Gallery */}
      {images.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Generated Images</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((img: any) => (
              <div key={img.id} className="group relative rounded-xl overflow-hidden bg-bg-800 aspect-square">
                <img src={img.url} alt={img.description} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                  <p className="text-xs text-white line-clamp-3">{img.description}</p>
                  <a href={img.url} download className="self-end">
                    <Download size={16} className="text-white" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
