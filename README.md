# 🎙️ Recall. — Meeting Intelligence Hub

**Recall.** turns raw meeting transcripts into structured, actionable insight. Upload a `.txt` or `.vtt` transcript and it extracts the decisions made, the action items (who / what / by when / priority), and the meeting's tone and dynamics, then lets you ask natural-language questions across all your meetings through a RAG chatbot that cites its sources.

---

## 🚀 Features

- **Decision & action-item extraction.** An LLM returns structured JSON, which is validated and normalised before it's stored.
- **Sentiment & dynamics.** Overall tone, a per-speaker breakdown, per-topic segments, and conflict, agreement, frustration and enthusiasm flags.
- **RAG chatbot.** Ask about a single meeting or across all of them. Answers are grounded in retrieved transcript chunks, and citations come from retrieval metadata rather than the LLM, so they can't be hallucinated.
- **Transcript parsing.** WebVTT cues, voice tags and timestamps are stripped, and speakers are detected automatically.
- **Export.** Download any analysis as CSV or PDF.
- **Auth & data isolation.** Supabase Auth (JWT) with automatic token refresh. Postgres Row-Level Security makes sure users can only ever see their own meetings.

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 (Vite), React Router, Tailwind CSS v4 |
| Backend | FastAPI, Uvicorn |
| Auth & database | Supabase (Auth + Postgres with RLS) |
| LLM | Groq API (`openai/gpt-oss-120b`, configurable via `GROQ_MODEL`) |
| Embeddings | HuggingFace `all-MiniLM-L6-v2`, run locally with no API cost |
| Vector store | ChromaDB (one collection per meeting) |
| Chunking | LangChain `RecursiveCharacterTextSplitter` |
| Export | ReportLab (PDF), Python `csv` |
| Hosting | Vercel (frontend) · Render (backend) · Supabase (data) |

---

## 🏗️ Architecture

```
React SPA (Vercel) ──/api/* rewrite──▶ FastAPI (Render)
                                          │
              ┌───────────────────────────┼─────────────────────────────┐
              ▼                           ▼                             ▼
   Supabase Auth + Postgres         Groq LLM API              ChromaDB + MiniLM
   (users, meetings, RLS)     (extraction, sentiment,      (local embeddings and
                                  chat answers)              vector search)
```

- **Per-request user client.** Each API request builds a Supabase client carrying the caller's JWT, so Postgres RLS enforces data isolation in the database itself, not in application code.
- **Self-healing vector index.** Chroma lives on the backend's local disk, which Render wipes on redeploy. When a search finds a meeting's collection empty, the backend rebuilds it from the transcript stored in Postgres.
- **Analysis pipeline** (`POST /api/analysis/analyse/{id}`): extract decisions and actions, then sentiment, then index chunks for RAG, then save the JSON result to `meetings.analysis_results`. Indexing failures don't discard the analysis, since chat rebuilds the index on demand.

---

## ⚙️ Local Setup

**Prerequisites:** Node.js 20+, Python 3.11+, a [Supabase](https://supabase.com) project, a [Groq](https://console.groq.com) API key.

### 1. Database
In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates the `meetings` table and its RLS policies.

### 2. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
python download_model.py         # one-time: caches the embedding model in backend/hf_cache
uvicorn main:app --reload        # http://localhost:8000  (API docs at /docs)
```

`backend/.env`:
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # only used for account deletion
GROQ_API_KEY=<groq key>
# GROQ_MODEL=openai/gpt-oss-120b               # optional override
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173, proxies /api to :8000
```

### 4. Try it
Sign up, then upload the sample transcripts in [`samples/`](samples/), open one and click **Analyse with AI**.

---

## 🧪 Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

The suite runs fully offline: Supabase, the LLM and the vector store are faked. It covers transcript parsing, LLM-output normalisation, and the API routes (auth guard, upload validation, analysis, chat, exports).

---

## 📡 API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/refresh` | Sign up, sign in, refresh an expired access token |
| GET / PUT / DELETE | `/api/auth/me` · `/me/name` | Profile, display name, delete account and all data |
| POST | `/api/transcripts/upload` | Upload one or more `.txt` / `.vtt` files |
| GET / DELETE | `/api/transcripts` · `/api/transcripts/{id}` | List, fetch or delete meetings |
| POST | `/api/analysis/analyse/{id}` | Run (or re-run) AI analysis |
| POST | `/api/chat/ask` | RAG question over one meeting or all of them |
| GET | `/api/export/{id}/csv` · `/pdf` | Download the analysis |

All routes except register, login, refresh and health require `Authorization: Bearer <token>`.

---

## 📄 License

Built for educational and hackathon purposes.
