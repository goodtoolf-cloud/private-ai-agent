// FILE: frontend/src/pages/DocumentsPage.tsx
import { useState } from "react";
import { FileText, Download, Loader2, Plus } from "lucide-react";
import { documentsAPI } from "../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const FORMAT_ICONS: Record<string, string> = { pdf: "📄", docx: "📝", xlsx: "📊" };

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("pdf");
  const [instructions, setInstructions] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<any>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsAPI.list().then((r) => r.data),
  });

  const create = async () => {
    if (!topic.trim()) return;
    setCreating(true);
    setLastCreated(null);
    try {
      const res = await documentsAPI.create({ topic, format, instructions });
      setLastCreated(res.data);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Document Creation</h1>
        <p className="text-sm text-slate-400 mt-1">AI writes and generates Word, PDF, or Excel files — ready to download.</p>
      </div>

      {/* Form */}
      <div className="card space-y-4">
        <div>
          <label className="text-sm text-slate-400 mb-1.5 block">Topic / Title</label>
          <input
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Project proposal for mobile app / Q3 Financial Report / API Documentation..."
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1.5 block">Format</label>
          <div className="flex gap-2">
            {["pdf", "docx", "xlsx"].map((f) => (
              <button key={f} onClick={() => setFormat(f)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  format === f ? "bg-primary text-white" : "bg-bg-700 border border-bg-600 text-slate-400 hover:text-white"
                }`}>
                {FORMAT_ICONS[f]} {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1.5 block">Additional instructions (optional)</label>
          <textarea
            className="input"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Include executive summary / Use formal language / Focus on technical details..."
          />
        </div>

        <button onClick={create} disabled={creating || !topic.trim()} className="btn-primary flex items-center gap-2">
          {creating ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
          {creating ? "AI is writing..." : `Create ${format.toUpperCase()}`}
        </button>
      </div>

      {/* Just created */}
      {lastCreated && (
        <div className="card border-primary/30 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{FORMAT_ICONS[lastCreated.type]}</span>
            <div>
              <p className="font-medium text-white">{lastCreated.topic}</p>
              <p className="text-xs text-slate-400">{lastCreated.filename}</p>
            </div>
          </div>
          <a href={lastCreated.url} download className="btn-primary flex items-center gap-2 text-sm">
            <Download size={14} /> Download
          </a>
        </div>
      )}

      {/* List */}
      {docs.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Generated Documents</h2>
          <div className="space-y-2">
            {docs.map((d: any) => (
              <div key={d.id} className="card flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">{FORMAT_ICONS[d.type] || "📄"}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm truncate">{d.description}</p>
                    <p className="text-xs text-slate-500">{d.type.toUpperCase()} · {new Date(d.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <a href={d.url} download className="btn-ghost flex items-center gap-1 text-xs flex-shrink-0">
                  <Download size={12} /> Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
