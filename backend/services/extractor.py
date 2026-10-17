from services.llm_client import ask_ai, parse_json_response

EXTRACTION_SYSTEM_PROMPT = """You are an expert meeting analyst.
Your job is to carefully read meeting transcripts and extract:
1. Key decisions that were made
2. Action items that were assigned to specific people

Always respond with valid JSON only. No explanations, no markdown, just JSON."""

PRIORITIES = {"high", "medium", "low"}


def extract_decisions_and_actions(transcript_text: str) -> dict:
    """
    Asks the LLM for decisions and action items as structured JSON.
    Returns {"decisions": [...], "action_items": [...]}; both lists are empty
    if the model's reply can't be parsed.
    """
    prompt = f"""Please analyse this meeting transcript and extract all decisions and action items.

TRANSCRIPT:
{transcript_text}

Return a JSON object in exactly this format:
{{
  "decisions": [
    {{
      "description": "what was decided",
      "context": "brief reason or context for the decision"
    }}
  ],
  "action_items": [
    {{
      "who": "person responsible",
      "what": "what they need to do",
      "by_when": "deadline if mentioned, otherwise 'Not specified'",
      "priority": "high/medium/low based on context"
    }}
  ]
}}

Rules:
- Only include things explicitly mentioned in the transcript
- For action items, extract the exact person's name if mentioned
- If no deadline is given, use "Not specified"
- Decisions are things the group agreed on
- Action items are tasks assigned to specific people"""

    response = ask_ai(prompt, system=EXTRACTION_SYSTEM_PROMPT, max_tokens=3000)
    result = parse_json_response(response)
    if not isinstance(result, dict):
        return {"decisions": [], "action_items": []}
    return normalise_extraction(result)


def normalise_extraction(result: dict) -> dict:
    """Coerces the model's output into the exact shape the frontend and exports expect."""
    decisions = [
        {
            "description": str(d.get("description") or "").strip(),
            "context": str(d.get("context") or "").strip(),
        }
        for d in (result.get("decisions") or [])
        if isinstance(d, dict) and d.get("description")
    ]

    action_items = []
    for a in result.get("action_items") or []:
        if not isinstance(a, dict) or not a.get("what"):
            continue
        priority = str(a.get("priority") or "").strip().lower()
        action_items.append({
            "who": str(a.get("who") or "Unassigned").strip(),
            "what": str(a.get("what")).strip(),
            "by_when": str(a.get("by_when") or "Not specified").strip(),
            "priority": priority if priority in PRIORITIES else "medium",
        })

    return {"decisions": decisions, "action_items": action_items}
