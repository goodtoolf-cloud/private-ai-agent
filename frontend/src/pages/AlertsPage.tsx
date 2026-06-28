// FILE: frontend/src/pages/AlertsPage.tsx
import { useState } from "react";
import { Bell, Plus, Play, Trash2, CheckCircle, Clock } from "lucide-react";
import { alertsAPI } from "../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "../store";
import ReactMarkdown from "react-markdown";

export default function AlertsPage() {
  const qc = useQueryClient();
  const { setUnreadAlerts } = useAppStore();
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const [interval, setInterval] = useState(60);
  const [creating, setCreating] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<Record<string, string>>({});

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsAPI.list().then((r) => r.data),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await alertsAPI.getNotifications();
      const unread = res.data.filter((n: any) => !n.is_read).length;
      setUnreadAlerts(unread);
      return res.data;
    },
  });

  const createAlert = async () => {
    if (!topic.trim() || !query.trim()) return;
    setCreating(true);
    try {
      await alertsAPI.create(topic, query, interval);
      setTopic(""); setQuery(""); setInterval(60);
      qc.invalidateQueries({ queryKey: ["alerts"] });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const runCheck = async (id: string) => {
    setCheckingId(id);
    try {
      const res = await alertsAPI.check(id);
      setCheckResult((prev) => ({ ...prev, [id]: res.data.summary }));
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err: any) {
      setCheckResult((prev) => ({ ...prev, [id]: "Check failed: " + err.message }));
    } finally {
      setCheckingId(null);
    }
  };

  const deleteAlert = async (id: string) => {
    await alertsAPI.delete(id);
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const markRead = async (id: string) => {
    await alertsAPI.markRead(id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const unreadNotifications = notifications.filter((n: any) => !n.is_read);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Topic Monitoring</h1>
        <p className="text-sm text-slate-400 mt-1">Tell the agent what topics to monitor. It checks the web and notifies you of updates.</p>
      </div>

      {/* Unread notifications */}
      {unreadNotifications.length > 0 && (
        <div className="card border-primary/30 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h2 className="font-semibold text-white">New Updates ({unreadNotifications.length})</h2>
          </div>
          {unreadNotifications.map((n: any) => (
            <div key={n.id} className="bg-bg-800 border border-bg-700 rounded-lg p-3 space-y-2">
              <div className="prose-ai text-sm text-slate-300">
                <ReactMarkdown>{n.summary}</ReactMarkdown>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">{new Date(n.created_at).toLocaleString()}</p>
                <button onClick={() => markRead(n.id)} className="text-xs text-primary-light hover:underline flex items-center gap-1">
                  <CheckCircle size={10} /> Mark read
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create alert */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-white text-sm">Create New Alert</h2>
        <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic name (e.g. AI News, Bitcoin Price, My Company)" />
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search query (e.g. artificial intelligence latest developments 2025)" />
        <div className="flex items-center gap-3">
          <select className="input flex-1" value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every hour</option>
            <option value={360}>Every 6 hours</option>
            <option value={1440}>Every 24 hours</option>
          </select>
          <button onClick={createAlert} disabled={creating || !topic.trim() || !query.trim()} className="btn-primary flex items-center gap-2 flex-shrink-0">
            <Plus size={14} /> {creating ? "..." : "Create Alert"}
          </button>
        </div>
      </div>

      {/* Alert list */}
      {alerts.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Active Monitors</h2>
          <div className="space-y-3">
            {alerts.map((a: any) => (
              <div key={a.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${a.is_active ? "bg-success" : "bg-slate-600"}`} />
                      <p className="font-medium text-white">{a.topic}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{a.query}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Clock size={10} /> Every {a.interval_minutes < 60 ? a.interval_minutes + "m" : a.interval_minutes / 60 + "h"}
                      </span>
                      {a.last_check && (
                        <span className="text-xs text-slate-600">Last: {new Date(a.last_check).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => runCheck(a.id)} disabled={checkingId === a.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-700 border border-bg-600 text-slate-400 hover:text-white text-xs transition-colors">
                      {checkingId === a.id ? "Checking..." : <><Play size={12} /> Check Now</>}
                    </button>
                    <button onClick={() => deleteAlert(a.id)} className="text-slate-600 hover:text-danger transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {checkResult[a.id] && (
                  <div className="bg-bg-900 border border-bg-700 rounded-lg p-3 prose-ai text-sm text-slate-300">
                    <ReactMarkdown>{checkResult[a.id]}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Bell size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm">No monitors yet. Create one to get notified about topics you care about.</p>
        </div>
      )}
    </div>
  );
}
