import main
import routers.analysis
import routers.chat
from fastapi.testclient import TestClient
from services.llm_client import LLMError

MEETING_ID = "22222222-2222-2222-2222-222222222222"
ANALYSIS = {
    "decisions": [{"description": "Ship Friday", "context": "Q&A <done>"}],
    "action_items": [{"who": "Mike", "what": "Write notes", "by_when": "Friday", "priority": "high"}],
}


def test_protected_routes_require_a_token():
    unauthenticated = TestClient(main.app)
    for method, path in [("get", "/api/transcripts"), ("post", "/api/chat/ask"), ("get", f"/api/export/{MEETING_ID}/pdf")]:
        assert getattr(unauthenticated, method)(path).status_code in (401, 403)


def test_upload_parses_vtt_and_detects_speakers(client, db):
    vtt = b"WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nAlex: Morning all.\n"
    res = client.post("/api/transcripts/upload", files=[("files", ("standup.vtt", vtt, "text/vtt"))])
    assert res.status_code == 200
    uploaded = res.json()["uploaded"][0]
    assert uploaded["speakers"] == ["Alex"]
    assert db.tables["meetings"][0]["transcript_text"] == "Alex: Morning all."


def test_upload_rejects_whole_batch_if_any_file_is_invalid(client, db):
    res = client.post("/api/transcripts/upload", files=[
        ("files", ("good.txt", b"A: hi", "text/plain")),
        ("files", ("bad.pdf", b"%PDF", "application/pdf")),
    ])
    assert res.status_code == 400
    assert db.tables.get("meetings", []) == []


def test_upload_rejects_empty_file(client):
    res = client.post("/api/transcripts/upload", files=[("files", ("empty.txt", b"  \n", "text/plain"))])
    assert res.status_code == 400


def test_invalid_meeting_id_is_422_not_500(client):
    assert client.get("/api/transcripts/not-a-uuid").status_code == 422


def test_delete_unknown_meeting_is_404(client):
    assert client.delete(f"/api/transcripts/{MEETING_ID}").status_code == 404


def test_analyse_persists_results(client, db, meeting, monkeypatch):
    monkeypatch.setattr(routers.analysis, "extract_decisions_and_actions", lambda _t: ANALYSIS)
    monkeypatch.setattr(routers.analysis, "analyse_sentiment", lambda _t, _s: {"overall_sentiment": "positive"})

    res = client.post(f"/api/analysis/analyse/{MEETING_ID}")
    assert res.status_code == 200
    assert res.json()["action_items"][0]["who"] == "Mike"

    stored = db.tables["meetings"][0]
    assert stored["status"] == "processed"
    assert stored["analysis_results"]["sentiment"]["overall_sentiment"] == "positive"

    listing = client.get("/api/transcripts").json()["meetings"][0]
    assert listing["action_items_count"] == 1 and listing["decisions_count"] == 1


def test_analyse_reports_llm_failure_as_502(client, meeting, monkeypatch):
    def fail(_t):
        raise LLMError("rate limited")
    monkeypatch.setattr(routers.analysis, "extract_decisions_and_actions", fail)

    res = client.post(f"/api/analysis/analyse/{MEETING_ID}")
    assert res.status_code == 502
    assert res.json()["detail"] == "rate limited"


def test_chat_only_searches_processed_meetings(client, meeting, monkeypatch):
    monkeypatch.setattr(routers.chat, "query_transcripts", lambda *_: {"answer": "should not be called", "sources": []})
    res = client.post("/api/chat/ask", json={"question": "What was decided?"})
    assert res.status_code == 200
    assert "no analysed meetings" in res.json()["answer"]


def test_exports_escape_markup_and_use_meeting_filename(client, meeting):
    meeting.update(status="processed", analysis_results={**ANALYSIS, "sentiment": {"overall_sentiment": "positive"}})

    pdf = client.get(f"/api/export/{MEETING_ID}/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert 'filename="standup_sync_analysis.pdf"' in pdf.headers["content-disposition"]

    csv = client.get(f"/api/export/{MEETING_ID}/csv")
    assert csv.status_code == 200
    assert "Q&A <done>" in csv.content.decode("utf-8-sig")


def test_export_before_analysis_is_400(client, meeting):
    assert client.get(f"/api/export/{MEETING_ID}/csv").status_code == 400
