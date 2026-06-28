// FILE: frontend/src/pages/VoicePage.tsx
import { useState, useRef } from "react";
import { Mic, MicOff, Volume2, Loader2, Play, Square } from "lucide-react";
import { voiceAPI } from "../services/api";

export default function VoicePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [language, setLanguage] = useState("en");
  const audioRef = useRef<HTMLAudioElement>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        setLoading(true);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "voice.webm");
        try {
          const res = await voiceAPI.transcribe(form);
          setTranscript(res.data.text);
          setLanguage(res.data.language || "en");
        } catch (err: any) {
          setTranscript("Transcription failed: " + err.message);
        } finally {
          setLoading(false);
          stream.getTracks().forEach((t) => t.stop());
        }
      };
      mr.start();
      mrRef.current = mr;
      setIsRecording(true);
    } catch {
      alert("Microphone access denied. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    mrRef.current?.stop();
    setIsRecording(false);
  };

  const synthesize = async () => {
    if (!ttsText.trim()) return;
    setTtsLoading(true);
    setTtsUrl(null);
    try {
      const res = await voiceAPI.speak(ttsText);
      if (res.data.success) {
        setTtsUrl(res.data.url);
        setTimeout(() => audioRef.current?.play(), 100);
      }
    } catch (err: any) {
      alert("TTS failed: " + err.message);
    } finally {
      setTtsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Voice</h1>
        <p className="text-sm text-slate-400 mt-1">
          Speech-to-text via Whisper (local, private) · Text-to-speech via Piper TTS (local, private).
        </p>
      </div>

      {/* STT */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-white">🎤 Speech to Text (Whisper)</h2>
        <p className="text-xs text-slate-500">Supports: MP3, WAV, M4A, OGG, WebM, MP4. Runs 100% locally.</p>

        <div className="flex items-center gap-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              isRecording
                ? "bg-danger text-white animate-pulse-ring"
                : "bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            {isRecording ? <><MicOff size={18} /> Stop Recording</> : <><Mic size={18} /> Start Recording</>}
          </button>
          {loading && <Loader2 size={18} className="spin text-primary" />}
          {language && transcript && (
            <span className="badge bg-bg-700 text-slate-400 text-xs">Detected: {language}</span>
          )}
        </div>

        {transcript && (
          <div className="bg-bg-900 border border-bg-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-2">Transcript:</p>
            <p className="text-white">{transcript}</p>
          </div>
        )}

        {/* File upload alternative */}
        <div className="border-t border-bg-700 pt-4">
          <p className="text-sm text-slate-400 mb-2">Or upload an audio file:</p>
          <input
            type="file"
            accept="audio/*,video/*"
            className="text-sm text-slate-400 file:btn-primary file:mr-3 file:rounded-lg file:border-0 file:text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLoading(true);
              const form = new FormData();
              form.append("audio", file);
              try {
                const res = await voiceAPI.transcribe(form);
                setTranscript(res.data.text);
                setLanguage(res.data.language || "en");
              } catch (err: any) {
                setTranscript("Error: " + err.message);
              } finally {
                setLoading(false);
              }
            }}
          />
        </div>
      </div>

      {/* TTS */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-white">🔊 Text to Speech (Piper TTS)</h2>
        <p className="text-xs text-slate-500">Converts any text to natural speech. Runs 100% locally with Piper.</p>

        <textarea
          className="input"
          rows={4}
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
          placeholder="Enter text to convert to speech..."
        />

        <button onClick={synthesize} disabled={ttsLoading || !ttsText.trim()} className="btn-primary flex items-center gap-2">
          {ttsLoading ? <Loader2 size={16} className="spin" /> : <Volume2 size={16} />}
          {ttsLoading ? "Generating audio..." : "Convert to Speech"}
        </button>

        {ttsUrl && (
          <div className="bg-bg-900 border border-bg-700 rounded-xl p-4 space-y-2">
            <p className="text-xs text-slate-500">Generated audio:</p>
            <audio ref={audioRef} controls src={ttsUrl} className="w-full" />
            <a href={ttsUrl} download className="text-xs text-primary-light hover:underline">Download audio file</a>
          </div>
        )}
      </div>
    </div>
  );
}
