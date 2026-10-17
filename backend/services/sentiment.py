from services.llm_client import ask_ai, parse_json_response

SENTIMENT_SYSTEM_PROMPT = """You are an expert in workplace communication and meeting dynamics.
Analyse meeting transcripts for sentiment, tone, and emotional dynamics.
Always respond with valid JSON only. No explanations, no markdown, just JSON."""

FLAG_KEYS = ("has_conflict", "has_strong_agreement", "has_frustration", "has_enthusiasm")


def analyse_sentiment(transcript_text: str, speakers: list) -> dict:
    """
    Asks the LLM for overall tone, per-speaker sentiment, per-topic segments and
    boolean dynamics flags. Falls back to a neutral result if the reply can't be parsed.
    """
    prompt = f"""Analyse the sentiment and tone of this meeting transcript.

TRANSCRIPT:
{transcript_text}

SPEAKERS IDENTIFIED: {', '.join(speakers) if speakers else 'Unknown'}

Return a JSON object in exactly this format:
{{
  "overall_sentiment": "positive/negative/neutral/mixed",
  "summary": "2-3 sentence summary of the meeting tone and dynamics",
  "speaker_sentiments": [
    {{
      "speaker": "name",
      "sentiment": "positive/negative/neutral",
      "notes": "brief observation about this speaker's tone"
    }}
  ],
  "segments": [
    {{
      "topic": "what was being discussed",
      "sentiment": "positive/negative/neutral/conflict/agreement",
      "intensity": "low/medium/high"
    }}
  ],
  "flags": {{
    "has_conflict": false,
    "has_strong_agreement": false,
    "has_frustration": false,
    "has_enthusiasm": false
  }}
}}

Rules:
- Be objective and professional
- Base analysis only on what is in the transcript"""

    response = ask_ai(prompt, system=SENTIMENT_SYSTEM_PROMPT, max_tokens=2000)
    result = parse_json_response(response)
    if not isinstance(result, dict):
        result = {"summary": "Could not analyse sentiment."}
    return normalise_sentiment(result)


def normalise_sentiment(result: dict) -> dict:
    """Coerces the model's output into the exact shape the frontend and exports expect."""
    flags = result.get("flags") if isinstance(result.get("flags"), dict) else {}

    def lower(value, default="neutral"):
        return str(value or default).strip().lower()

    return {
        "overall_sentiment": lower(result.get("overall_sentiment")),
        "summary": str(result.get("summary") or "").strip(),
        "speaker_sentiments": [
            {"speaker": str(s.get("speaker") or ""), "sentiment": lower(s.get("sentiment")), "notes": str(s.get("notes") or "")}
            for s in (result.get("speaker_sentiments") or [])
            if isinstance(s, dict) and s.get("speaker")
        ],
        "segments": [
            {"topic": str(s.get("topic") or ""), "sentiment": lower(s.get("sentiment")), "intensity": lower(s.get("intensity"), "low")}
            for s in (result.get("segments") or [])
            if isinstance(s, dict) and s.get("topic")
        ],
        # str() check so a model replying "false" (a string) isn't read as truthy
        "flags": {key: str(flags.get(key)).lower() == "true" for key in FLAG_KEYS},
    }
