// FILE: frontend/src/pages/ChatPage.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, Paperclip, Plus, Mic, MicOff, Globe, Trash2, X, AlertCircle } from "lucide-react";
import { chatAPI, filesAPI, voiceAPI } from "../services/api";
import { useAppStore } from "../store";
import MessageBubble from "../components/MessageBubble";
import ModelSelector from "../components/ModelSelector";
import clsx from "clsx";

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const {
    conversations, messages, activeConversationId, selectedModel, isLoading,
    setConversations, setMessages, setActiveConversation, addMessage, setLoading,
  } = useAppStore();

  const [input, setInput] = useState("");
  const [includeWebSearch, setIncludeWebSearch] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ id: string; name: string; type: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load conversations list
  useEffect(() => {
    chatAPI.listConversations().then((r) => setConversations(r.data)).catch(() => {});
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      setActiveConversation(conversationId);
      chatAPI.getMessages(conversationId).then((r) => setMessages(r.data)).catch(() => setMessages([]));
    } else {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() && !uploadedFile) return;
    const text = input.trim();
    setInput("");
    setWarning(null);
    setLoading(true);

    const userMsg = {
      id: Date.now().toString(),
      role: "user" as const,
      content: text,
    };
    addMessage(userMsg);

    try {
      const res = await chatAPI.send({
        message: text,
        conversation_id: activeConversationId || undefined,
        model: selectedModel,
        has_file: !!uploadedFile,
        file_type: uploadedFile?.type || "",
      });

      const data = res.data;
      if (data.warning) setWarning(data.warning);

      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        model_used: data.model_used,
        confidence: data.confidence,
      });

      if (!conversationId && data.conversation_id) {
        navigate(`/chat/${data.conversation_id}`, { replace: true });
      }

      // Refresh conversations list
      chatAPI.listConversations().then((r) => setConversations(r.data)).catch(() => {});
    } catch (err: any) {
      addMessage({
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Error: ${err.response?.data?.detail || err.message || "Something went wrong."}`,
      });
    } finally {
      setLoading(false);
      setUploadedFile(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("question", "Analyze and summarize this file.");
    try {
      const res = await filesAPI.upload(form);
      setUploadedFile({
        id: res.data.file_id,
        name: file.name,
        type: res.data.file_type,
      });
      addMessage({
        id: Date.now().toString(),
        role: "assistant",
        content: `**File analyzed:** ${file.name}\n\n${res.data.analysis}`,
        model_used: res.data.model_used,
      });
    } catch (err: any) {
      alert("Upload failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "voice.webm");
        try {
          const res = await voiceAPI.transcribe(form);
          setInput(res.data.text);
        } catch {}
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const newChat = () => navigate("/chat");
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await chatAPI.deleteConversation(id);
    setConversations(conversations.filter((c) => c.id !== id));
    if (id === activeConversationId) newChat();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Conversation sidebar */}
      <div className="w-48 bg-bg-800 border-r border-bg-700 flex flex-col">
        <div className="p-3 border-b border-bg-700">
          <button onClick={newChat} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
            <Plus size={14} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/chat/${c.id}`)}
              className={clsx(
                "group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors",
                c.id === activeConversationId
                  ? "bg-bg-700 text-white"
                  : "text-slate-400 hover:bg-bg-700 hover:text-white"
              )}
            >
              <span className="truncate flex-1">{c.title || "Untitled"}</span>
              <button
                onClick={(e) => deleteConversation(c.id, e)}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-danger transition-opacity ml-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bg-700 bg-bg-900">
          <h1 className="font-semibold text-white text-sm">
            {activeConversationId
              ? conversations.find((c) => c.id === activeConversationId)?.title || "Chat"
              : "New Conversation"}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIncludeWebSearch(!includeWebSearch)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border",
                includeWebSearch
                  ? "bg-primary/20 border-primary text-primary-light"
                  : "border-bg-700 text-slate-500 hover:text-white"
              )}
            >
              <Globe size={12} /> Web Search
            </button>
            <ModelSelector />
          </div>
        </div>

        {/* Warning banner */}
        {warning && (
          <div className="mx-4 mt-3 flex items-start gap-2 bg-warning/10 border border-warning/30 text-warning rounded-lg px-3 py-2 text-sm">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{warning}</span>
            <button onClick={() => setWarning(null)} className="ml-auto"><X size=14 /></button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-bg-800 border border-bg-700 flex items-center justify-center">
                <span className="text-3xl">🤖</span>
              </div>
              <div>
                <p className="font-medium text-slate-300 mb-1">Your Private AI Agent</p>
                <p className="text-sm">Ask anything. Upload files. Research the web.</p>
                <p className="text-xs mt-1">100% private — nothing leaves your server.</p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} {...m} />
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs">AI</span>
              </div>
              <div className="bg-bg-800 border border-bg-700 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full bg-primary animate-pulse-ring"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Attached file chip */}
        {uploadedFile && (
          <div className="px-4 pb-1">
            <span className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/30 text-primary-light rounded-full px-3 py-1 text-xs">
              📎 {uploadedFile.name}
              <button onClick={() => setUploadedFile(null)}><X size={10} /></button>
            </span>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-bg-700">
          <div className="flex items-end gap-2 bg-bg-800 border border-bg-700 rounded-2xl px-3 py-2 focus-within:border-primary transition-colors">
            <button
              onClick={() => fileRef.current?.click()}
              className="text-slate-500 hover:text-white transition-colors p-1 flex-shrink-0"
              title="Upload file"
            >
              <Paperclip size={18} />
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-slate-500 resize-none focus:outline-none text-sm max-h-32"
              style={{ lineHeight: "1.5" }}
            />

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={clsx(
                "p-1 flex-shrink-0 transition-colors",
                isRecording ? "text-danger animate-pulse-ring" : "text-slate-500 hover:text-white"
              )}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button
              onClick={sendMessage}
              disabled={isLoading || (!input.trim() && !uploadedFile)}
              className="btn-primary p-2 rounded-xl flex-shrink-0"
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-1">
            Private · No data shared · Powered by Cloudflare Workers AI
          </p>
        </div>
      </div>
    </div>
  );
}
