# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Recall.** ("meeting-intelligence-hub") is a monorepo with two independently deployed apps:

- `backend/` — FastAPI app that extracts decisions/action items/sentiment from meeting transcripts via an LLM, and answers questions about them via RAG.
- `frontend/` — React (Vite) + Tailwind SPA.

Deployed as: frontend → Vercel, backend → Render, relational data → Supabase (Postgres + Auth), vectors → local ChromaDB on the backend's disk. DB schema + RLS policies: `supabase/schema.sql`. Sample transcripts: `samples/`.

## Commands

### Backend (`backend/`)

```bash
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python download_model.py       # one-time: caches the embedding model into backend/hf_cache
uvicorn main:app --reload      # runs on http://localhost:8000
pip install -r requirements-dev.txt && pytest   # offline test suite
```

Requires `backend/.env` with `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` (optional `GROQ_MODEL`, default `openai/gpt-oss-120b`).

`backend/tests/` is a pytest suite that runs fully offline: `conftest.py` provides `FakeDB` (an in-memory stand-in for supabase-py's chained query builder) and overrides the `get_current_user` / `get_user_db` dependencies; LLM and Chroma calls are monkeypatched. Never point tests at the real Supabase project.

### Frontend (`frontend/`)

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api -> http://127.0.0.1:8000 (see vite.config.js)
npm run build
npm run lint
```

Requires `frontend/.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (currently unused by code: all Supabase access goes through the backend).

## Architecture

### Request flow and auth model

The backend does **not** own user data storage or session state; Supabase is the source of truth for both:

- Supabase clients come from `services/supabase_client.py` (`get_anon_client`, `get_user_client(token)`, `get_admin_client`). Routers take `db: Client = Depends(get_user_db)`, a **per-request client scoped to the caller's JWT**, so Postgres Row-Level Security enforces per-user isolation and there is no app-level `WHERE user_id = ...` in most queries. The service-role admin client is only used to delete auth users.
- `routers/auth.py` defines `security` (`HTTPBearer`), `get_current_user` (validates the token with Supabase Auth: `AuthApiError` → 401, network/other errors → 503 so outages don't log users out) and `get_user_db`. Every non-auth route depends on both, including the export routes. `/api/auth/refresh` exchanges a refresh token for a new session.
- Meeting-id path params are typed `UUID`, so malformed ids get a 422 instead of a PostgREST 500.
- Endpoints that call the LLM or embeddings are plain `def` (not `async def`) so FastAPI runs them in its threadpool. Keep it that way.
- `main.py` calls `load_dotenv()` **before** importing routers (services read env at import time) and installs a catch-all handler so every error response is JSON `{"detail": ...}`.
- Frontend API access goes only through `src/api/client.js`: `apiFetch` / `apiJson` attach the token; on a 401 they call `/api/auth/refresh` once (via a shared promise) and retry, otherwise clear the session and redirect to `/login?expired=1`. Errors are thrown as `ApiError` with a user-readable message. `downloadFile` does authenticated CSV/PDF downloads via blob URLs. Pass `auth: false` for login/register.

### Storage split: Postgres vs. local ChromaDB

- Meeting transcripts (cleaned by the parser), metadata, and `analysis_results` (JSON: decisions/action_items/sentiment) live in the Supabase `meetings` table.
- Vector embeddings for RAG live in **local-disk ChromaDB** (`backend/storage/chroma_db/`), one collection per meeting named `meeting_{meeting_id}`. This is *not* synced to any external store, so after a backend redeploy/restart the collections are gone even though Postgres data survives.
- `services/rag_engine.py` owns the single `chromadb.PersistentClient` (absolute path, telemetry off) and talks to Chroma directly, with no LangChain vectorstore wrapper. `_get_collection` lazily rebuilds an empty collection from `transcript_text` in Supabase. Any new code that reads from Chroma should go through it. `index_transcript` is idempotent (it deletes the collection first). Queries embed the question once, rank hits across meetings globally, keep `TOP_K`, and cite only meetings within `SOURCE_MARGIN` of the best distance.
- Deleting a meeting or a user account must clean up both stores: delete in Postgres, then `rag_engine.delete_index(meeting_id)` (best-effort). See `delete_meeting` in `routers/transcripts.py` and `delete_account` in `routers/auth.py`.

### AI pipeline (`services/`)

- `llm_client.py` wraps the **Groq** API and is the only place that talks to the LLM. `ask_ai(prompt, system=None, max_tokens=...)` uses `GROQ_MODEL` (`llama-3.3-70b-versatile` was retired by Groq). For gpt-oss reasoning models it sends `reasoning_effort="low"` and adds token headroom. Provider failures are raised as `LLMError` (rate limits get a friendly message), and routers turn `LLMError` into HTTP 502 with that message.
- `extractor.py` and `sentiment.py` both build a JSON-only prompt, call `ask_ai`, parse with `parse_json_response` (regex `\{.*\}` then `json.loads`, returning `None` on failure), fall back to an empty/neutral result, then **normalise** (`normalise_extraction` / `normalise_sentiment`) so every field has a fixed type. Follow the same parse → fallback → normalise shape for any new structured-extraction prompt.
- `transcript_parser.py`: `parse_transcript(raw, ext)` normalises line endings (including `\r\r\n`). For `.vtt` it strips the header, NOTE blocks, cue ids, timestamps and markup line by line, and merges consecutive same-speaker cues. `extract_speakers` finds `Name:` prefixes (capitalised, ≤4 words, ignoring labels like `Agenda:`).
- `rag_engine.py` embeds with a **local** HuggingFace model (`all-MiniLM-L6-v2`, loaded once at import; `HF_HOME` is pinned to `backend/hf_cache/` so it reuses the cache from `download_model.py`), with no embedding API calls. Chunking is `RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)`. `posthog<4` is pinned because chromadb 0.5.x telemetry crashes on newer posthog.
- The analysis pipeline (`routers/analysis.py: analyse_meeting`) runs extraction, sentiment, then RAG indexing, and writes the combined result to `meetings.analysis_results`. An indexing failure is logged but does not fail the request. It can be re-run (the UI has a Re-analyse button).
- Chat (`routers/chat.py`) only searches meetings with `status = 'processed'`.

### Frontend structure

- Routing in `App.jsx`: `Welcome`, `Login` and `Register` are public. `Dashboard`, `Upload` and `MeetingDetail` are nested under the `AppLayout` layout route, which redirects to `/login` without a token, renders `Navbar` once, fetches `/api/auth/me` once and passes `{ profile }` to pages through `<Outlet context>` (`useOutletContext()`). `NameModal` (first visit, or "Change display name") lives in the layout.
- Styling is plain Tailwind v4 (via `@tailwindcss/vite`) with inline hex colours; there is no component library.
- `ChatPanel.jsx` is the RAG chat UI (`POST /api/chat/ask`) and renders the backend's `sources` as citations.

### CSV/PDF export

`GET /api/export/{id}/csv` and `/pdf` use the normal `Authorization` header; tokens are never put in URLs. The frontend downloads them with `downloadFile`. PDF text goes through `xml.sax.saxutils.escape` and `PDF_SAFE_CHARS`, because ReportLab parses Paragraph text as markup and its built-in fonts lack glyphs such as U+2011.
