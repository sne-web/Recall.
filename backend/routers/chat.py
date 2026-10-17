from fastapi import APIRouter, HTTPException, Depends
from supabase import Client
from models.schemas import ChatRequest
from routers.auth import get_current_user, get_user_db
from services.rag_engine import query_transcripts
from services.llm_client import LLMError

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/ask")
def ask_question(request: ChatRequest, user=Depends(get_current_user), db: Client = Depends(get_user_db)):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Only analysed meetings are searchable. RLS already limits rows to this user;
    # the explicit user_id filter is defence in depth for the vector-store lookup.
    query = db.table("meetings").select("id, filename").eq("user_id", str(user.id)).eq("status", "processed")
    if request.meeting_id:
        query = query.eq("id", str(request.meeting_id))
    meetings = query.execute().data

    if not meetings:
        return {
            "answer": "There are no analysed meetings to search yet. Upload a transcript and run the analysis first.",
            "sources": [],
        }

    try:
        return query_transcripts(question, meetings, db)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
