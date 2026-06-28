// FILE: frontend/src/pages/MemoryPage.tsx
import { useState } from "react";
import { Brain, Plus, Trash2, Search, X } from "lucide-react";
import { memoryAPI } from "../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const CATEGORIES = ["general", "preferences", "facts", "habits", "goals", "work", "personal"];
const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-slate-700 text-slate-300",
  preferences: "bg-violet-900 text-violet-300",
  facts: "bg-blue-900 text-blue-300",
  habits: "bg-green-900 text-green-300",
  goals: "bg-yellow-900 text-yellow-300",
  work: "bg-orange-900 text-orange-300",
  personal: "bg-pink-900 text-pink-300",
};

export default function MemoryPage() {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("general");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: memories = [] } = useQuery({
    queryKey: ["memories"],
    queryFn: () => memoryAPI.list().then((r) => r.data),
  });

  const addMemory = async () => {
    if (!key.trim() || !value.trim()) return;
    await memoryAPI.add(key.trim(), value.trim(), category);
    setKey(""); setValue(""); setCategory("general");
    qc.invalidateQueries({ queryKey: ["memories"] });
  };

  const deleteMemory = async (id: string) => {
    await memoryAPI.delete(id);
    qc.invalidateQueries({ queryKey: ["memories"] });
  };

  const clearAll = async () => {
    if (!confirm("Clear all memories?")) return;
    await memoryAPI.clear();
    qc.invalidateQueries({ queryKey: ["memories"] });
  };

  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const res = await memoryAPI.search(searchQ);
      setSearchResults(res.data.results || []);
    } catch {}
    setSearching(false);
  };

  const grouped = memories.reduce((acc: Record<string, any[]>, m: any) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Memory</h1>
          <p className="text-sm text-slate-400 mt-1">The agent remembers facts about you across all conversations.</p>
        </div>
        {memories.length > 0 && (
          <button onClick={clearAll} className="text-xs text-danger hover:underline flex items-center gap-1">
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      {/* Add memory */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm">Add a memory</h2>
        <div className="flex gap-2">
          <input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key (e.g. Preferred language)" />
          <select className="input w-40 flex-shrink-0" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <textarea className="input" rows={2} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value (e.g. English, but I also speak Spanish)" />
        <button onClick={addMemory} disabled={!key.trim() || !value.trim()} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Add Memory
        </button>
      </div>

      {/* Search */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm">Search memories</h2>
        <div className="flex gap-2">
          <input className="input" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()} placeholder="Find relevant memories..." />
          <button onClick={doSearch} disabled={searching} className="btn-primary px-4 flex items-center gap-2 flex-shrink-0">
            <Search size={14} /> {searching ? "..." : "Search"}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((r, i) => (
              <div key={i} className="bg-bg-900 border border-bg-700 rounded-lg px-3 py-2 text-sm">
                <p className="text-white">{r.text}</p>
                <p className="text-xs text-slate-500 mt-1">Similarity: {(r.similarity * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grouped memories */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`badge ${CATEGORY_COLORS[cat] || CATEGORY_COLORS["general"]}`}>{cat}</span>
            <span className="text-xs text-slate-600">{(items as any[]).length}</span>
          </div>
          <div className="space-y-2">
            {(items as any[]).map((m) => (
              <div key={m.id} className="card flex items-start gap-3">
                <Brain size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">{m.key}</p>
                  <p className="text-sm text-white mt-0.5">{m.value}</p>
                  <p className="text-xs text-slate-600 mt-1">{new Date(m.last_updated).toLocaleString()}</p>
                </div>
                <button onClick={() => deleteMemory(m.id)} className="text-slate-600 hover:text-danger transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {memories.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Brain size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm">No memories yet. The agent will automatically build memory as you chat.</p>
          <p className="text-xs mt-1 text-slate-600">You can also add memories manually above.</p>
        </div>
      )}
    </div>
  );
}
