// FILE: frontend/src/store.ts
import { create } from "zustand";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  model_used?: string;
  confidence?: number;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  model_used: string;
  updated_at: string;
}

interface AppState {
  // Chat
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  selectedModel: string;
  isLoading: boolean;

  // Notifications
  unreadAlerts: number;

  setConversations: (c: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (m: Message[]) => void;
  addMessage: (m: Message) => void;
  setSelectedModel: (m: string) => void;
  setLoading: (v: boolean) => void;
  setUnreadAlerts: (n: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  selectedModel: "auto",
  isLoading: false,
  unreadAlerts: 0,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setLoading: (isLoading) => set({ isLoading }),
  setUnreadAlerts: (unreadAlerts) => set({ unreadAlerts }),
}));
