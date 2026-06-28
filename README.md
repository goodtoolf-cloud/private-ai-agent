# Private AI Agent

Your fully private, self-hosted AI assistant. No data sent to anyone. Free forever.

---

## Features

| Feature | Tool | Free? |
|---------|------|-------|
| Chat (3 AI models) | Cloudflare Workers AI | ✅ Free |
| Web Search | SearXNG (self-hosted) | ✅ Free |
| File Analysis | Built-in parser | ✅ Free |
| Image Generation | Stable Diffusion via CF | ✅ Free |
| Code Execution | E2B / local | ✅ Free |
| Document Creation | ReportLab + python-docx | ✅ Free |
| Charts & Graphs | Matplotlib | ✅ Free |
| Voice Input | Whisper (local) | ✅ Free |
| Voice Output | Piper TTS (local) | ✅ Free |
| Memory & RAG | ChromaDB (local) | ✅ Free |
| Translation | LibreTranslate | ✅ Free |
| Topic Monitoring | Scheduled + SearXNG | ✅ Free |
| Knowledge Base | ChromaDB embeddings | ✅ Free |

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/yourusername/private-ai-agent
cd private-ai-agent
cp .env.example .env
```

Edit `.env` — you only **need** two values:
- `CLOUDFLARE_ACCOUNT_ID` — from [dash.cloudflare.com](https://dash.cloudflare.com)
- `CLOUDFLARE_API_TOKEN` — create at Cloudflare dashboard → API Tokens → "Workers AI" permission

### 2. Start everything

```bash
docker compose up -d
```

That's it. Visit **http://localhost:3000**

---

## File Structure

```
project/
├── backend/                    # Python FastAPI backend
│   ├── main.py                 # App entry point, router registration
│   ├── config.py               # All settings from .env
│   ├── database.py             # Async SQLAlchemy setup
│   ├── models.py               # DB models (conversations, memory, etc.)
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile
│   ├── routers/
│   │   ├── chat.py             # Core chat, model selection, streaming
│   │   ├── files.py            # File upload + AI analysis
│   │   ├── search.py           # Web search + deep research
│   │   ├── images.py           # Image generation (Stable Diffusion)
│   │   ├── code.py             # Code execution + chart generation
│   │   ├── memory.py           # User memory CRUD
│   │   ├── documents.py        # Document creation (PDF/DOCX/XLSX)
│   │   ├── voice.py            # STT (Whisper) + TTS (Piper)
│   │   ├── alerts.py           # Topic monitoring
│   │   └── knowledge.py        # Knowledge base (RAG)
│   └── services/
│       ├── cloudflare.py       # Cloudflare Workers AI (3 models)
│       ├── searxng.py          # Web search via SearXNG
│       ├── chroma_service.py   # ChromaDB vector store
│       ├── file_parser.py      # Parse PDF/DOCX/Excel/images
│       ├── image_gen.py        # Stable Diffusion via Cloudflare
│       ├── code_executor.py    # E2B sandbox / local execution
│       ├── document_creator.py # Create Word/PDF/Excel files
│       ├── voice_service.py    # Whisper STT + Piper TTS
│       └── translator.py       # LibreTranslate + deep-translator
│
├── frontend/                   # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── main.tsx            # Entry point
│   │   ├── App.tsx             # Router setup
│   │   ├── store.ts            # Zustand global state
│   │   ├── index.css           # Tailwind + custom styles
│   │   ├── services/
│   │   │   └── api.ts          # All API calls (axios)
│   │   ├── components/
│   │   │   ├── Layout.tsx      # Sidebar + nav
│   │   │   ├── MessageBubble.tsx # Chat message with markdown
│   │   │   └── ModelSelector.tsx # Model dropdown
│   │   └── pages/
│   │       ├── ChatPage.tsx    # Main chat interface
│   │       ├── FilesPage.tsx   # File upload + analysis
│   │       ├── SearchPage.tsx  # Web search + research
│   │       ├── ImagesPage.tsx  # Image generation
│   │       ├── CodePage.tsx    # Code runner + charts
│   │       ├── DocumentsPage.tsx # Document creation
│   │       ├── VoicePage.tsx   # STT + TTS
│   │       ├── MemoryPage.tsx  # User memory management
│   │       ├── AlertsPage.tsx  # Topic monitoring
│   │       └── KnowledgePage.tsx # Knowledge base
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── nginx.conf
│
├── searxng/
│   └── settings.yml            # SearXNG config
│
├── docker-compose.yml          # All services
├── .env.example                # Copy to .env
└── README.md
```

---

## AI Models

| Model | When Used | Cloudflare ID |
|-------|-----------|---------------|
| DeepSeek R1 | Research, reasoning, code | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` |
| Llama 3.3 | Fast general questions | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| Gemini Flash | Files, images, audio | `@cf/google/gemma-7b-it-lora` |

**Auto mode** picks the best model based on your message content.

---

## Cloudflare Free Limits

- **10,000 requests/day** (resets midnight UTC)
- **300,000 requests/month**
- Counts per request, not per token — long research = 1 request
- More than enough for personal use

---

## Voice Setup (Piper TTS)

Piper TTS runs completely locally. To enable it:

```bash
# Inside the backend container, download the voice model
docker exec -it ai_backend bash
mkdir -p /app/models/piper
cd /app/models/piper
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
```

If Piper is not set up, the app falls back to gTTS (requires internet).

---

## Services

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| SearXNG | http://localhost:8080 |
| ChromaDB | http://localhost:8001 |
| PostgreSQL | localhost:5432 |

---

## Data Privacy

Everything runs on your machine:
- **Conversations** → PostgreSQL (your database)
- **Memory** → ChromaDB (your vector store)
- **Generated files** → local filesystem
- **AI compute** → Cloudflare (only your prompt is sent, no history stored by Cloudflare)
- **Web search** → SearXNG → search engines (your IP, no tracking)

---

## Adding to Android (WebView APK)

Use Android Studio or a simple WebView wrapper:

```kotlin
// MainActivity.kt
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.loadUrl("http://YOUR_SERVER_IP:3000")
        setContentView(webView)
    }
}
```

Replace `YOUR_SERVER_IP` with your server's local IP address.
