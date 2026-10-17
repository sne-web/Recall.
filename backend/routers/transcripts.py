import os
import uuid
from typing import List
from uuid import UUID
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from supabase import Client
from routers.auth import get_current_user, get_user_db
from services.transcript_parser import parse_transcript, extract_speakers
from services.rag_engine import delete_index

router = APIRouter(prefix="/api/transcripts", tags=["transcripts"])

ALLOWED_EXTENSIONS = {".txt", ".vtt"}
MAX_FILE_BYTES = 2 * 1024 * 1024  # 2 MB of text is far longer than any real meeting


def _analysis_fields(m: dict) -> dict:
    analysis = m.get("analysis_results") or {}
    return {
        "decisions": analysis.get("decisions", []),
        "action_items": analysis.get("action_items", []),
        "sentiment": analysis.get("sentiment"),
    }


@router.post("/upload")
async def upload_transcripts(files: List[UploadFile] = File(...), user=Depends(get_current_user),
                             db: Client = Depends(get_user_db)):
    # Validate every file before inserting anything, so a bad file doesn't leave a partial upload.
    parsed = []
    for file in files:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"{file.filename}: only .txt and .vtt files are supported")

        content = await file.read()
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail=f"{file.filename}: file is larger than 2 MB")

        text = parse_transcript(content.decode("utf-8", errors="ignore"), ext)
        if not text.strip():
            raise HTTPException(status_code=400, detail=f"{file.filename}: file contains no transcript text")
        parsed.append((file.filename, text))

    rows = [
        {
            "id": str(uuid.uuid4()),
            "user_id": str(user.id),
            "filename": filename,
            "status": "uploaded",
            "word_count": len(text.split()),
            "speakers": extract_speakers(text),
            "transcript_text": text,
        }
        for filename, text in parsed
    ]
    inserted = db.table("meetings").insert(rows).execute().data

    uploaded = [
        {k: m[k] for k in ("id", "filename", "upload_date", "word_count", "speakers")}
        for m in inserted
    ]
    return {"uploaded": uploaded, "count": len(uploaded)}


# Registered with and without the trailing slash so the Vercel → Render proxy
# never triggers FastAPI's trailing-slash redirect straight to the Render origin.
@router.get("")
@router.get("/")
def list_meetings(user=Depends(get_current_user), db: Client = Depends(get_user_db)):
    res = (
        db.table("meetings")
        .select("id, filename, upload_date, status, word_count, speakers, analysis_results")
        .order("upload_date", desc=True)
        .execute()
    )

    meetings = []
    for m in res.data:
        analysis = _analysis_fields(m)
        meetings.append({
            "id": m["id"],
            "filename": m["filename"],
            "upload_date": m["upload_date"],
            "word_count": m["word_count"],
            "speakers": m["speakers"] or [],
            "status": m["status"],
            "action_items_count": len(analysis["action_items"]),
            "decisions_count": len(analysis["decisions"]),
        })
    return {"meetings": meetings}


@router.get("/{meeting_id}")
def get_meeting(meeting_id: UUID, user=Depends(get_current_user), db: Client = Depends(get_user_db)):
    res = db.table("meetings").select("*").eq("id", str(meeting_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    m = res.data[0]
    return {
        "id": m["id"],
        "filename": m["filename"],
        "upload_date": m["upload_date"],
        "status": m["status"],
        "transcript_text": m.get("transcript_text") or "",
        "word_count": m.get("word_count") or 0,
        "speakers": m.get("speakers") or [],
        **_analysis_fields(m),
    }


@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: UUID, user=Depends(get_current_user), db: Client = Depends(get_user_db)):
    res = db.table("meetings").delete().eq("id", str(meeting_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Embeddings live in the local vector store, not Postgres, so clean them up separately.
    delete_index(str(meeting_id))
    return {"deleted": True, "meeting_id": str(meeting_id)}
