// FILE: frontend/src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 120_000,
});

export default api;

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatAPI = {
  send: (data: {
    message: string;
    conversation_id?: string;
    model?: string;
    has_file?: boolean;
    file_type?: string;
  }) => api.post("/chat/", data),

  listConversations: () => api.get("/chat/conversations"),

  getMessages: (id: string) => api.get(`/chat/conversations/${id}/messages`),

  deleteConversation: (id: string) => api.delete(`/chat/conversations/${id}`),
};

// ── Files ─────────────────────────────────────────────────────────────────────
export const filesAPI = {
  upload: (formData: FormData) =>
    api.post("/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 180_000,
    }),

  list: () => api.get("/files/"),

  delete: (id: string) => api.delete(`/files/${id}`),
};

// ── Search ────────────────────────────────────────────────────────────────────
export const searchAPI = {
  search: (query: string, num_results = 10) =>
    api.post("/search/", { query, num_results }),

  fetch: (url: string) => api.post("/search/fetch", { url }),

  research: (query: string, num_results = 5) =>
    api.post("/search/research", { query, num_results, deep_research: true }),
};

// ── Images ────────────────────────────────────────────────────────────────────
export const imagesAPI = {
  generate: (data: {
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    steps?: number;
  }) => api.post("/images/generate", data),

  list: () => api.get("/images/"),
};

// ── Code ──────────────────────────────────────────────────────────────────────
export const codeAPI = {
  run: (data: { code: string; language?: string; auto_fix?: boolean }) =>
    api.post("/code/run", data),

  chart: (data: {
    data: object[];
    chart_type?: string;
    title?: string;
    x_key?: string;
    y_key?: string;
  }) => api.post("/code/chart", data),
};

// ── Memory ────────────────────────────────────────────────────────────────────
export const memoryAPI = {
  add: (key: string, value: string, category = "general") =>
    api.post("/memory/", { key, value, category }),

  list: () => api.get("/memory/"),

  search: (query: string) => api.post("/memory/search", { query, n_results: 5 }),

  delete: (id: string) => api.delete(`/memory/${id}`),

  clear: () => api.delete("/memory/"),
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsAPI = {
  create: (data: {
    topic: string;
    format: string;
    instructions?: string;
    data?: unknown[][];
    headers?: string[];
  }) => api.post("/documents/create", data),

  list: () => api.get("/documents/"),
};

// ── Voice ─────────────────────────────────────────────────────────────────────
export const voiceAPI = {
  transcribe: (formData: FormData) =>
    api.post("/voice/transcribe", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  speak: (text: string) => api.post("/voice/speak", { text }),
};

// ── Alerts ────────────────────────────────────────────────────────────────────
export const alertsAPI = {
  create: (topic: string, query: string, interval_minutes = 60) =>
    api.post("/alerts/", { topic, query, interval_minutes }),

  list: () => api.get("/alerts/"),

  check: (id: string) => api.post(`/alerts/${id}/check`),

  getNotifications: () => api.get("/alerts/notifications"),

  markRead: (id: string) => api.patch(`/alerts/notifications/${id}/read`),

  delete: (id: string) => api.delete(`/alerts/${id}`),
};

// ── Knowledge Base ────────────────────────────────────────────────────────────
export const knowledgeAPI = {
  upload: (formData: FormData) =>
    api.post("/knowledge/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 180_000,
    }),

  list: () => api.get("/knowledge/"),

  search: (query: string) =>
    api.post("/knowledge/search", null, { params: { query } }),

  updateTrust: (id: string, trust_level: number) =>
    api.patch(`/knowledge/${id}/trust`, null, { params: { trust_level } }),

  delete: (id: string) => api.delete(`/knowledge/${id}`),
};
