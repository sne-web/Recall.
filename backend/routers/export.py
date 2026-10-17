import csv
import io
import os
import re
from uuid import UUID
from xml.sax.saxutils import escape
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from supabase import Client
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from routers.auth import get_current_user, get_user_db

router = APIRouter(prefix="/api/export", tags=["export"])

TABLE_STYLE = TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#161b22")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
])


# The built-in PDF fonts have no glyphs for these (LLMs emit them often), so they'd render as ■
PDF_SAFE_CHARS = str.maketrans({"‐": "-", "‑": "-", " ": " ", " ": " "})


def _get_meeting(meeting_id: UUID, db: Client) -> dict:
    res = db.table("meetings").select("filename, upload_date, analysis_results").eq("id", str(meeting_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    m = res.data[0]
    analysis = m.get("analysis_results")
    if not analysis:
        raise HTTPException(status_code=400, detail="This meeting hasn't been analysed yet")

    return {
        "filename": m["filename"],
        "upload_date": (m.get("upload_date") or "")[:10],
        "sentiment": analysis.get("sentiment") or {},
        "decisions": analysis.get("decisions") or [],
        "action_items": analysis.get("action_items") or [],
    }


def _download_name(filename: str, ext: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9_-]+", "_", os.path.splitext(filename)[0]).strip("_") or "meeting"
    return f"{stem}_analysis.{ext}"


@router.get("/{meeting_id}/csv")
def export_csv(meeting_id: UUID, user=Depends(get_current_user), db: Client = Depends(get_user_db)):
    meeting = _get_meeting(meeting_id, db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Meeting File", meeting["filename"]])
    writer.writerow(["Upload Date", meeting["upload_date"]])
    writer.writerow(["Overall Sentiment", meeting["sentiment"].get("overall_sentiment", "")])
    writer.writerow([])

    writer.writerow(["DECISIONS"])
    writer.writerow(["Decision", "Context"])
    for dec in meeting["decisions"]:
        writer.writerow([dec.get("description", ""), dec.get("context", "")])
    writer.writerow([])

    writer.writerow(["ACTION ITEMS"])
    writer.writerow(["Who", "What", "By When", "Priority"])
    for item in meeting["action_items"]:
        writer.writerow([item.get("who", ""), item.get("what", ""), item.get("by_when", ""), item.get("priority", "")])

    return StreamingResponse(
        # BOM so Excel opens UTF-8 (names with accents, em dashes) correctly
        iter(["﻿" + output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{_download_name(meeting["filename"], "csv")}"'},
    )


@router.get("/{meeting_id}/pdf")
def export_pdf(meeting_id: UUID, user=Depends(get_current_user), db: Client = Depends(get_user_db)):
    meeting = _get_meeting(meeting_id, db)

    styles = getSampleStyleSheet()
    h1, h2, normal = styles["Heading1"], styles["Heading2"], styles["Normal"]

    def para(value, style=normal):
        # reportlab parses Paragraph text as mini-XML, so a raw "&" or "<" would crash the build
        return Paragraph(escape(str(value or "").translate(PDF_SAFE_CHARS)), style)

    elements = [
        para(f"Meeting Analysis: {meeting['filename']}", h1),
        para(f"Date: {meeting['upload_date'] or 'N/A'}"),
        Spacer(1, 12),
    ]

    sentiment = meeting["sentiment"]
    if sentiment:
        elements += [
            para("Sentiment Overview", h2),
            para(f"Overall: {sentiment.get('overall_sentiment', 'N/A')}"),
            para(f"Summary: {sentiment.get('summary', 'N/A')}"),
            Spacer(1, 12),
        ]

    if meeting["decisions"]:
        data = [["Decision", "Context"]] + [
            [para(d.get("description")), para(d.get("context"))] for d in meeting["decisions"]
        ]
        table = Table(data, colWidths=[200, 270])
        table.setStyle(TABLE_STYLE)
        elements += [para("Decisions", h2), table, Spacer(1, 12)]

    if meeting["action_items"]:
        data = [["Who", "What", "By When", "Priority"]] + [
            [para(a.get("who")), para(a.get("what")), para(a.get("by_when")), para(a.get("priority"))]
            for a in meeting["action_items"]
        ]
        table = Table(data, colWidths=[80, 230, 90, 70])
        table.setStyle(TABLE_STYLE)
        elements += [para("Action Items", h2), table]

    buffer = io.BytesIO()
    SimpleDocTemplate(buffer, pagesize=letter, title=f"Meeting Analysis: {meeting['filename']}").build(elements)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_download_name(meeting["filename"], "pdf")}"'},
    )
