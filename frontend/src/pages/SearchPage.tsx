// FILE: frontend/src/pages/SearchPage.tsx
import { useState } from "react";
import { Search, Globe, BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { searchAPI } from "../services/api";
import ReactMarkdown from "react-markdown";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"search" | "research" | "fetch">("search");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const run = async () => {
    if (!query.trim() && !url.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      if (mode === "search") {
        const res = await searchAPI.search(query, 10);
        setResults({ type: "search", data: res.data });
      } else if (mode === "research") {
        const res = await searchAPI.research(query, 5);
        setResults({ type: "research", data: res.data });
      } else {
        const res = await searchAPI.fetch(url);
        setResults({ type: "fetch", data: res.data });
      }
    } catch (err: any) {
      setResults({ type: "error", data: { error: err.message } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Web Research</h1>
        <p className="text-sm text-slate-400 mt-1">Search the web, do deep research, or read any URL — all private.</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2">
        {(["search", "research", "fetch"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m ? "bg-primary text-white" : "bg-bg-800 border border-bg-700 text-slate-400 hover:text-white"
            }`}
          >
            {m === "search" ? "Quick Search" : m === "research" ? "Deep Research" : "Read URL"}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        {mode === "fetch" ? (
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => e.key === "Enter" && run()}
          />
        ) : (
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "research" ? "Research: AI trends in 2025" : "Search: latest news..."}
            onKeyDown={(e) => e.key === "Enter" && run()}
          />
        )}
        <button onClick={run} disabled={loading} className="btn-primary px-5 flex items-center gap-2 flex-shrink-0">
          {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          {mode === "research" ? "Research" : "Go"}
        </button>
      </div>

      {mode === "research" && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2 text-xs text-blue-300">
          Deep Research: fetches 5 sources, reads full content, synthesizes a comprehensive AI report. Takes 30-60 seconds.
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 size={32} className="spin text-primary" />
          <p className="text-slate-400 text-sm">
            {mode === "research" ? "Researching across multiple sources..." : "Searching..."}
          </p>
        </div>
      )}

      {results && !loading && (
        <div className="space-y-4">
          {results.type === "search" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">{results.data.count} results for "{results.data.query}"</p>
              {results.data.results.map((r: any, i: number) => (
                <div key={i} className="card space-y-1">
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex items-start gap-2">
                    <Globe size={14} className="text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-white text-sm hover:text-primary-light transition-colors">
                        {r.title}
                        <ExternalLink size={10} className="inline ml-1 text-slate-500" />
                      </p>
                      <p className="text-xs text-slate-500 truncate">{r.url}</p>
                    </div>
                  </a>
                  {r.content && <p className="text-xs text-slate-400 mt-1 pl-6">{r.content}</p>}
                </div>
              ))}
            </div>
          )}

          {results.type === "research" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-primary" />
                <h2 className="font-semibold text-white">Research Report</h2>
                <span className="badge bg-bg-700 text-slate-400">{results.data.source_count} sources</span>
              </div>
              <div className="card prose-ai text-sm text-slate-300">
                <ReactMarkdown>{results.data.report}</ReactMarkdown>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Sources</h3>
                <div className="space-y-1">
                  {results.data.sources.map((s: any, i: number) => (
                    <a key={i} href={s.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-primary-light transition-colors">
                      <ExternalLink size={10} />
                      {s.title || s.url}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {results.type === "fetch" && (
            <div className="card">
              <p className="text-xs text-slate-500 mb-2">{results.data.url} — {results.data.length} chars</p>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-[500px] overflow-y-auto">{results.data.content}</pre>
            </div>
          )}

          {results.type === "error" && (
            <div className="card bg-red-900/20 border-red-700/30">
              <p className="text-red-400 text-sm">Error: {results.data.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
