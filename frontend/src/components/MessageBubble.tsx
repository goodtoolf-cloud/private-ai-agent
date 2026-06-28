// FILE: frontend/src/components/MessageBubble.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Bot, User, CheckCircle, AlertTriangle } from "lucide-react";
import clsx from "clsx";

interface Props {
  role: "user" | "assistant";
  content: string;
  model_used?: string;
  confidence?: number;
}

const MODEL_COLORS: Record<string, string> = {
  deepseek: "bg-violet-900 text-violet-300",
  llama: "bg-green-900 text-green-300",
  gemini: "bg-blue-900 text-blue-300",
  auto: "bg-slate-700 text-slate-300",
};

const MODEL_LABELS: Record<string, string> = {
  deepseek: "DeepSeek R1",
  llama: "Llama 3.3",
  gemini: "Gemini Flash",
  auto: "Auto",
};

export default function MessageBubble({ role, content, model_used, confidence }: Props) {
  const isUser = role === "user";

  return (
    <div className={clsx("flex gap-3 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
          <Bot size={15} className="text-white" />
        </div>
      )}

      <div className={clsx("max-w-[80%] space-y-2", isUser && "items-end")}>
        {/* Model badge */}
        {!isUser && model_used && (
          <div className="flex items-center gap-2">
            <span className={clsx("badge text-[10px]", MODEL_COLORS[model_used] || MODEL_COLORS["auto"])}>
              {MODEL_LABELS[model_used] || model_used}
            </span>
            {confidence !== undefined && confidence !== null && (
              <span className={clsx(
                "badge text-[10px]",
                confidence >= 80 ? "bg-green-900 text-green-300"
                  : confidence >= 60 ? "bg-yellow-900 text-yellow-300"
                  : "bg-red-900 text-red-300"
              )}>
                {confidence >= 80 ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                {confidence}% confident
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={clsx(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-tr-sm"
            : "bg-bg-800 border border-bg-700 text-slate-200 rounded-tl-sm prose-ai"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isBlock = !props.inline && match;
                  return isBlock ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus as any}
                      language={match![1]}
                      PreTag="div"
                      customStyle={{ margin: "0.5rem 0", borderRadius: "8px", fontSize: "0.8rem" }}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-bg-700 flex items-center justify-center flex-shrink-0 mt-1">
          <User size={15} className="text-slate-300" />
        </div>
      )}
    </div>
  );
}
