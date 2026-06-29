# Private AI Agent — Cloudflare Workers Backend

Full-featured AI agent backend running 100% on Cloudflare's free tier.  
No servers, no monthly bills, always-on, globally fast.

## Architecture

| Layer | Service | Notes |
|-------|---------|-------|
| Runtime | Cloudflare Workers (Hono) | TypeScript, V8 isolates |
| Database | Cloudflare D1 | SQL, 5 GB free |
| Files | Cloudflare R2 | Object storage, 10 GB free |
| Vectors | Cloudflare Vectorize | RAG/embeddings, 100K free |
| AI | Cloudflare Workers AI | DeepSeek R1, Llama 3.3, Gemma, Whisper, SDXL |
| Web Search | SearXNG (self-hosted) | Privacy-first, your instance |
| Cron | Cloudflare Cron Triggers | Hourly alert monitoring |

## Endpoints

| Route | Method | What it does |
|-------|--------|-------------|
| `/api/chat/` | POST | Chat with AI (auto model selection) |
| `/api/chat/conversations` | GET | List conversations |
| `/api/chat/conversations/:id/messages` | GET | Load conversation history |
| `/api/chat/conversations/:id` | DELETE | Delete conversation |
| `/api/files/upload` | POST | Upload + analyze file |
| `/api/files/` | GET | List files |
| `/api/files/download/:key` | GET | Download file from R2 |
| `/api/files/:id` | DELETE | Delete file |
| `/api/search/` | POST | Web search via SearXNG |
| `/api/search/fetch` | POST | Fetch + parse a webpage |
| `/api/search/research` | POST | Deep research (search + synthesize) |
| `/api/images/generate` | POST | Generate image via SDXL |
| `/api/images/` | GET | List generated images |
| `/api/code/run` | POST | Run code (E2B sandbox) or AI simulation |
| `/api/code/chart` | POST | Generate chart (QuickChart.io) |
| `/api/documents/create` | POST | Create document (HTML/CSV/Markdown) |
| `/api/documents/` | GET | List documents |
| `/api/voice/transcribe` | POST | Transcribe audio (Whisper) |
| `/api/voice/speak` | POST | Text to speech |
| `/api/voice/translate` | POST | Translate text (M2M100) |
| `/api/memory/` | POST/GET | Save or list memories |
| `/api/memory/search` | POST | Semantic memory search |
| `/api/memory/:id` | DELETE | Delete a memory |
| `/api/memory/` | DELETE | Clear all memories |
| `/api/knowledge/upload` | POST | Add document to knowledge base |
| `/api/knowledge/` | GET | List knowledge documents |
| `/api/knowledge/search` | GET | Search knowledge base |
| `/api/knowledge/:id/trust` | PATCH | Update document trust level |
| `/api/knowledge/:id` | DELETE | Remove knowledge document |
| `/api/alerts/` | POST/GET | Create or list monitoring alerts |
| `/api/alerts/:id/check` | POST | Manually check an alert now |
| `/api/alerts/notifications` | GET | List alert notifications |
| `/api/alerts/notifications/:id/read` | PATCH | Mark notification read |
| `/api/alerts/:id` | DELETE | Delete alert |

## Quick Start

### 1. Install dependencies

```bash
cd project/cf-backend
npm install
```

### 2. Create Cloudflare resources

```bash
# Create R2 bucket
npm run r2:create

# Create Vectorize indexes (384 dims, cosine)
npm run vectorize:create:memory
npm run vectorize:create:knowledge
```

### 3. Create D1 database

```bash
# Create the D1 database
npx wrangler d1 create ai-agent-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:
```toml
[[d1_databases]]
database_id = "PASTE_YOUR_ID_HERE"
```

### 4. Apply the database schema

```bash
# Local dev
npm run db:init

# Production
npm run db:init:remote
```

### 5. Create KV namespace

```bash
npx wrangler kv:namespace create CACHE
```

Paste the `id` into `wrangler.toml`:
```toml
[[kv_namespaces]]
id = "PASTE_YOUR_KV_ID_HERE"
```

### 6. Configure your SearXNG URL

In `wrangler.toml`, set your SearXNG instance URL:
```toml
[vars]
SEARXNG_URL = "https://your-searxng.example.com"
```

Or for local dev, set it as a secret:
```bash
npx wrangler secret put SEARXNG_URL
```

### 7. (Optional) Add E2B API key for real code execution

```bash
npx wrangler secret put E2B_API_KEY
```
Get a free key at https://e2b.dev — without it, code runs are AI-simulated.

### 8. Start local dev server

```bash
npm run dev
```

Visit `http://localhost:8787/api/health` to verify.

### 9. Deploy to production

```bash
npm run deploy
```

Your worker URL will be: `https://private-ai-agent.<your-subdomain>.workers.dev`

## Configure the Frontend

In your Cloudflare Pages project, set the environment variable:

```
VITE_API_URL=https://private-ai-agent.<your-subdomain>.workers.dev
```

Or if you use a custom domain, point `VITE_API_URL` there.

## AI Models Used

| Task | Model |
|------|-------|
| Reasoning / Research / Code | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` |
| Fast / General / Translation | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| Multimodal / Files / Images | `@cf/google/gemma-7b-it-lora` |
| Embeddings | `@cf/baai/bge-small-en-v1.5` (384 dims) |
| Image Generation | `@cf/stabilityai/stable-diffusion-xl-base-1.0` |
| Speech to Text | `@cf/openai/whisper` |
| Translation | `@cf/meta/m2m100-1.2b` |

Model selection is **automatic** based on task type (or you can specify manually).

## Cloudflare Free Tier Limits

| Service | Free Allowance |
|---------|---------------|
| Workers requests | 100,000/day |
| Workers CPU | 10ms/request (enough for routing + AI) |
| Workers AI | 10,000 neurons/day |
| D1 | 5 GB storage, 5M reads/day, 100K writes/day |
| R2 | 10 GB storage, 1M operations/month |
| Vectorize | 100K stored vectors, 30M queried dims/month |
| KV | 100K reads/day, 1K writes/day |

All free. No credit card required after the initial account.

## File Support

| Format | Upload | Analysis |
|--------|--------|----------|
| PDF | ✅ | Text extracted → AI analyzed |
| DOCX | ✅ | XML text extracted → AI analyzed |
| XLSX/CSV | ✅ | Full text parse |
| TXT/MD/JSON/Code | ✅ | Full text |
| PNG/JPG/WebP/GIF | ✅ | AI vision analysis |
| MP3/WAV/M4A | ✅ | Whisper transcription |
| MP4/WebM | ✅ | Audio track → Whisper |

## Notes

- **Code execution**: Real sandboxing requires E2B API key. Without it, AI simulates the execution (useful for understanding code without running it).
- **Document export**: PDF generation creates a print-ready HTML page. DOCX creates Markdown. Open in browser and print to PDF if needed.
- **Memory**: Conversation memory uses both D1 (key-value facts) and Vectorize (semantic search). Both are searched on every chat message.
- **Cron**: Alert monitoring runs automatically every hour via Cloudflare Cron Triggers — no external scheduler needed.
