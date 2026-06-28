// FILE: frontend/src/pages/KnowledgePage.tsx
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { BookOpen, Upload, Trash2, Star, Search, Loader2 } from "lucide-react";
import { knowledgeAPI } from "../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const TRUST_LABELS: Record<number, { label: string; color: string; stars: string }> = {
  3: { label: "High Trust", color: "text-yellow-400",  stars: "⭐⭐⭐" },
  2: { label: "Medium",     color: "text-slate-300",   stars: "⭐⭐" },
  1: { label: "Low Trust",  color: "text-slate-500",   stars: "⭐" },
};

export default function KnowledgePage() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [trustLevel, setTrustLevel] = useState(2);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: docs = [] } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => knowledgeAPI.list().then((r) => r.data),
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("title", docTitle || file.name);
    form.append("trust_level", String(trustLevel));
    try {
      await knowledgeAPI.upload(form);
      setDocTitle("");
      qc.invalidateQueries({ queryKey: ["knowledge"] });
    } catch (err: any) {
      alert("Upload failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  }, [docTitle, trustLevel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt", ".md"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
  });

  const updateTrust = async (id: string, level: number) => {
    await knowledgeAPI.updateTrust(id, level);
    qc.invalidateQueries({ queryKey: ["knowledge"] });
  };

  const deleteDoc = async (id: string) => {
    await knowledgeAPI.delete(id);
    qc.invalidateQueries({ queryKey: ["knowledge"] });
  };

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const res = await knowledgeAPI.search(searchQ);
      setSearchResults(res.data.results || []);
    } catch {}
    setSearching(false);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Knowledge Base</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload documents once — the agent reads and uses them in every future conversation automatically.
          Assign trust levels to resolve conflicts between sources.
        </p>
      </div>

      {/* Trust level explanation */}
      <div className="grid grid-cols-3 gap-3">
        {[3, 2, 1].map((l) => (
          <div key={l} className="card text-center">
            <p className="text-lg">{TRUST_LABELS[l].stars}</p>
            <p className={`text-sm font-medium ${TRUST_LABELS[l].color}`}>{TRUST_LABELS[l].label}</p>
            <p className="text-xs text-slate-600 mt-1">
              {l === 3 ? "Official docs, primary sources" : l === 2 ? "Reference books, guides" : "Articles, opinions"}
            </p>
          </div>
        ))}
      </div>

      {/* Upload */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm">Upload Document</h2>
        <div className="flex gap-2">
          <input className="input" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document title (optional)" />
          <select className="input w-48 flex-shrink-0" value={trustLevel} onChange={(e) => setTrustLevel(Number(e.target.value))}>
            <option value={3}>⭐⭐⭐ High Trust</option>
            <option value={2}>⭐⭐ Medium Trust</option>
            <option value={1}>⭐ Low Trust</option>
          </select>
        </div>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? "border-primary bg-primary/10" : "border-bg-700 hover:border-bg-600"
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="space-y-2">
              <Loader2 size={28} className="mx-auto spin text-primary" />
              <p className="text-sm text-slate-400">Embedding document into knowledge base...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload size={28} className="mx-auto text-slate-500" />
              <p className="text-white text-sm font-medium">Drop a document here or click to browse</p>
              <p className="text-xs text-slate-500">PDF, DOCX, TXT, CSV, XLSX</p>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm">Search Knowledge Base</h2>
        <div className="flex gap-2">
          <input className="input" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()} placeholder="Search across all documents..." />
          <button onClick={doSearch} disabled={searching} className="btn-primary px-4 flex items-center gap-2 flex-shrink-0">
            <Search size={14} /> {searching ? "..." : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {searchResults.map((r, i) => (
              <div key={i} className="bg-bg-900 border border-bg-700 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-primary-light font-medium">{r.metadata?.document_title}</p>
                  <span className="text-xs text-slate-600">
                    {TRUST_LABELS[r.metadata?.trust_level || 2]?.stars} · {(r.similarity * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-slate-300 text-xs line-clamp-4">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document list */}
      {docs.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Documents ({docs.length})</h2>
          <div className="space-y-2">
            {docs.map((d: any) => (
              <div key={d.id} className="card flex items-center gap-3">
                <BookOpen size={16} className="text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{d.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-500">{d.chunk_count} chunks indexed</span>
                    <span className="text-xs text-slate-600">{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Trust level selector */}
                  <select
                    value={d.trust_level}
                    onChange={(e) => updateTrust(d.id, Number(e.target.value))}
                    className="bg-bg-700 border border-bg-600 text-xs rounded px-2 py-1 text-slate-300 focus:outline-none"
                  >
                    <option value={3}>⭐⭐⭐</option>
                    <option value={2}>⭐⭐</option>
                    <option value={1}>⭐</option>
                  </select>
                  <button onClick={() => deleteDoc(d.id)} className="text-slate-600 hover:text-danger transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {docs.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <BookOpen size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm">No documents yet. Upload one to build your knowledge base.</p>
          <p className="text-xs mt-1 text-slate-600">The agent will automatically use all uploaded documents in every conversation.</p>
        </div>
      )}
    </div>
  );
}
