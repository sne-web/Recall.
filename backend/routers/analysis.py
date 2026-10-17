from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from routers.auth import get_current_user, get_user_db
from services.extractor import extract_decisions_and_actions
from services.sentiment import analyse_sentiment
from services.rag_engine import index_transcript
from services.llm_client import LLMError

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


# Plain `def` (not `async def`): the LLM and embedding calls are blocking, so FastAPI
# runs this in its threadpool instead of freezing the event loop for every other request.
@router.post("/analyse/{meeting_id}")
def analyse_meeting(meeting_id: UUID, user=Depends(get_current_user), db: Client = Depends(get_user_db)):
    meeting_id = str(meeting_id)
    res = db.table("meetings").select("transcript_text, speakers").eq("id", meeting_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    m = res.data[0]
    transcript_text = m.get("transcript_text") or ""
    if not transcript_text.strip():
        raise HTTPException(status_code=400, detail="Transcript text is empty")

    try:
        extraction = extract_decisions_and_actions(transcript_text)
        sentiment = analyse_sentiment(transcript_text, m.get("speakers") or [])
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Indexing only powers the chatbot, and the chatbot rebuilds missing indexes on
    # demand, so a failure here shouldn't throw away the analysis we just paid for.
    try:
        index_transcript(meeting_id, transcript_text)
    except Exception as e:
        print(f"Warning: RAG indexing failed for {meeting_id}: {e}")

    analysis_results = {
        "decisions": extraction["decisions"],
        "action_items": extraction["action_items"],
        "sentiment": sentiment,
    }
    db.table("meetings").update({"status": "processed", "analysis_results": analysis_results}).eq("id", meeting_id).execute()

    return {"meeting_id": meeting_id, "status": "processed", **analysis_results}
