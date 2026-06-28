// FILE: frontend/src/pages/FilesPage.tsx
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Trash2, FileSpreadsheet, Image as ImageIcon, Music } from "lucide-react";
import { filesAPI } from "../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

const FILE_ICONS: Record<string, any> = {
  pdf: FileText, docx: FileText, doc: FileText,
  xlsx: FileSpreadsheet, csv: FileSpreadsheet, xls: FileSpreadsheet,
  png: ImageIcon, jpg: ImageIcon, jpeg: ImageIcon,
  mp3: Music, wav: Music, mp4: Music,
};

function FileIcon({ type }: { type: string }) {
  const Icon = FILE_ICONS[type] || FileText;
  return <Icon size={20} className="text-primary" />;
}

export default function FilesPage() {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("Analyze and summarize this file.");
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  const { data: files = [] } = useQuery({
    queryKey: ["files"],
    queryFn: () => filesAPI.list().then((r) => r.data),
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    setCurrentFile(file.name);
    setAnalysisResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("question", question);
    try {
      const res = await filesAPI.upload(form);
      setAnalysisResult(res.data.analysis);
      qc.invalidateQueries({ queryKey: ["files"] });
    } catch (err: any) {
      setAnalysisResult("Error: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  }, [question]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg"],
      "video/*": [".mp4", ".webm"],
      "text/plain": [".txt", ".md"],
    },
  });

  const deleteFile = async (id: string) => {
    await filesAPI.delete(id);
    qc.invalidateQueries({ queryKey: ["files"] });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">File Analysis</h1>
        <p className="text-sm text-slate-400 mt-1">Upload any file — PDF, Excel, Word, images, audio, video — and ask questions about it.</p>
      </div>

      {/* Question input */}
      <div>
        <label className="text-sm text-slate-400 mb-2 block">What do you want to know about the file?</label>
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Summarize this file / What are the key points? / Extract all numbers..."
        />
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/10" : "border-bg-700 hover:border-bg-600"
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-2">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full spin mx-auto" />
            <p className="text-slate-400 text-sm">Analyzing {currentFile}...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload size={32} className="mx-auto text-slate-500" />
            <p className="text-white font-medium">Drop a file here or click to browse</p>
            <p className="text-slate-500 text-sm">PDF, Word, Excel, CSV, Images, Audio, Video, Text</p>
          </div>
        )}
      </div>

      {/* Analysis result */}
      {analysisResult && (
        <div className="card space-y-2">
          <h3 className="font-semibold text-white text-sm">Analysis: {currentFile}</h3>
          <div className="prose-ai text-sm text-slate-300">
            <ReactMarkdown>{analysisResult}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Uploaded Files</h2>
          <div className="space-y-2">
            {files.map((f: any) => (
              <div key={f.id} className="card flex items-start gap-3">
                <FileIcon type={f.file_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-white text-sm truncate">{f.original_name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-500">{formatSize(f.file_size)}</span>
                      <button onClick={() => deleteFile(f.id)} className="text-slate-600 hover:text-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {f.content_summary && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{f.content_summary}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-1">{new Date(f.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
