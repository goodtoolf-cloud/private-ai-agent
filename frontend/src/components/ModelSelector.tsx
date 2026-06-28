// FILE: frontend/src/components/ModelSelector.tsx
import { useAppStore } from "../store";

const MODELS = [
  { value: "auto",     label: "Auto",          desc: "Best model chosen automatically" },
  { value: "deepseek", label: "DeepSeek R1",   desc: "Deep research & reasoning" },
  { value: "llama",    label: "Llama 3.3",     desc: "Fast general questions" },
  { value: "gemini",   label: "Gemini Flash",  desc: "Files, images, audio" },
];

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useAppStore();

  return (
    <select
      value={selectedModel}
      onChange={(e) => setSelectedModel(e.target.value)}
      className="bg-bg-700 border border-bg-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary cursor-pointer"
    >
      {MODELS.map((m) => (
        <option key={m.value} value={m.value}>
          {m.value === "auto" ? "⚡ " : ""}{m.label}
        </option>
      ))}
    </select>
  );
}
