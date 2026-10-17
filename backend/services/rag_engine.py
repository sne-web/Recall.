import os

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# Use the model cache pre-downloaded at build time by download_model.py, instead of hitting the network.
os.environ["HF_HOME"] = os.path.join(BACKEND_DIR, "hf_cache")

import chromadb
from chromadb.config import Settings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from services.llm_client import ask_ai

CHROMA_DIR = os.path.join(BACKEND_DIR, "storage", "chroma_db")
TOP_K = 5  # chunks passed to the LLM per question, ranked across all searched meetings
# A meeting is cited only if its best chunk is within this distance of the overall best hit.
# Measured on the sample transcripts: relevant chunks score ~0.65-1.15, unrelated ones >=1.35.
SOURCE_MARGIN = 0.3

# Local sentence-transformer model: free, no API calls, ~80MB. Loaded once at import.
print("Loading embedding model...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2", model_kwargs={"device": "cpu"})
print("Embedding model loaded.")

chroma_client = chromadb.PersistentClient(path=CHROMA_DIR, settings=Settings(anonymized_telemetry=False))

# ~500-char chunks with 50 chars of overlap so a sentence cut at a boundary still
# appears whole in one of the two neighbouring chunks.
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)


def _collection_name(meeting_id: str) -> str:
    return f"meeting_{meeting_id}"


def _open_collection(meeting_id: str):
    # embedding_function=None: we always supply vectors ourselves from the HuggingFace model,
    # so Chroma must never fall back to its own default embedder.
    return chroma_client.get_or_create_collection(_collection_name(meeting_id), embedding_function=None)


def index_transcript(meeting_id: str, transcript_text: str) -> int:
    """Chunks + embeds a transcript into its own Chroma collection. Safe to call repeatedly."""
    delete_index(meeting_id)  # re-analysing a meeting must not duplicate its chunks

    chunks = splitter.split_text(transcript_text)
    if not chunks:
        return 0

    collection = _open_collection(meeting_id)
    collection.add(
        ids=[f"{meeting_id}-{i}" for i in range(len(chunks))],
        documents=chunks,
        embeddings=embeddings.embed_documents(chunks),
        metadatas=[{"meeting_id": meeting_id, "chunk_index": i} for i in range(len(chunks))],
    )
    return len(chunks)


def delete_index(meeting_id: str) -> None:
    try:
        chroma_client.delete_collection(_collection_name(meeting_id))
    except Exception:
        pass  # never indexed (e.g. meeting was never analysed) — nothing to delete


def _get_collection(meeting_id: str, db):
    """
    Returns the meeting's collection, rebuilding it from Postgres if it's empty.
    Chroma lives on the backend's local disk, which is wiped on every Render
    redeploy/restart, while the transcripts themselves survive in Supabase.
    """
    collection = _open_collection(meeting_id)
    if collection.count() > 0:
        return collection

    res = db.table("meetings").select("transcript_text").eq("id", meeting_id).execute()
    text = res.data[0].get("transcript_text") if res.data else None
    if not text:
        return None

    print(f"Vector index for meeting {meeting_id} missing — rebuilding from Supabase")
    index_transcript(meeting_id, text)
    return _open_collection(meeting_id)


def query_transcripts(question: str, meetings: list, db) -> dict:
    """
    RAG: embed the question, retrieve the most similar chunks across the given
    meetings, and have the LLM answer using only those chunks.

    meetings — [{"id", "filename"}] the caller is allowed to see (already RLS-filtered)
    db       — the caller's Supabase client, used to rebuild missing indexes
    """
    question_vector = embeddings.embed_query(question)

    hits = []  # (distance, meeting, chunk_text)
    for meeting in meetings:
        try:
            collection = _get_collection(meeting["id"], db)
            if collection is None:
                continue
            result = collection.query(
                query_embeddings=[question_vector],
                n_results=min(TOP_K, collection.count()),
            )
            for chunk, distance in zip(result["documents"][0], result["distances"][0]):
                hits.append((distance, meeting, chunk))
        except Exception as e:
            print(f"Vector search failed for meeting {meeting['id']}: {e}")

    if not hits:
        return {"answer": "I couldn't find any searchable transcript content for that question.", "sources": []}

    hits.sort(key=lambda h: h[0])  # smaller distance = more similar
    top_hits = hits[:TOP_K]

    context = "\n\n---\n\n".join(f"[Meeting: {m['filename']}]\n{chunk}" for _, m, chunk in top_hits)
    prompt = f"""You are a helpful meeting assistant. Answer the user's question using ONLY
the meeting transcript excerpts below.

- Be clear and concise. Name the people involved when relevant.
- If the excerpts come from more than one meeting, say which meeting each point is from.
- If the answer is not in the excerpts, say "I couldn't find that in the available transcripts."
- Do not invent details that are not in the excerpts.
- Reply in plain text. Do not use Markdown formatting such as ** or #.

TRANSCRIPT EXCERPTS:
{context}

QUESTION:
{question}"""

    answer = ask_ai(prompt, max_tokens=800)

    # Citations come from retrieval metadata, not from the LLM, so they can't be hallucinated.
    best_distance = top_hits[0][0]
    sources, seen = [], set()
    for distance, meeting, chunk in top_hits:
        if meeting["id"] in seen or distance > best_distance + SOURCE_MARGIN:
            continue
        seen.add(meeting["id"])
        snippet = chunk[:160].strip() + ("…" if len(chunk) > 160 else "")
        sources.append({"meeting_id": meeting["id"], "filename": meeting["filename"], "snippet": snippet})

    return {"answer": answer.strip(), "sources": sources}
