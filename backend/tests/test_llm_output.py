from services.llm_client import parse_json_response
from services.extractor import normalise_extraction
from services.sentiment import normalise_sentiment


def test_parse_json_inside_prose_and_code_fence():
    reply = 'Sure! Here you go:\n```json\n{"decisions": [], "action_items": []}\n```'
    assert parse_json_response(reply) == {"decisions": [], "action_items": []}


def test_parse_json_returns_none_for_garbage():
    assert parse_json_response("I can't help with that.") is None


def test_extraction_fills_defaults_and_drops_malformed_items():
    result = normalise_extraction({
        "decisions": [{"description": "Delay launch", "context": None}, "not a dict", {"context": "no description"}],
        "action_items": [
            {"who": "Sarah", "what": "Update docs", "by_when": None, "priority": "HIGH"},
            {"who": "Mike", "what": "Book room", "priority": "urgent"},
            {"who": "Nobody"},
        ],
    })
    assert result["decisions"] == [{"description": "Delay launch", "context": ""}]
    assert result["action_items"] == [
        {"who": "Sarah", "what": "Update docs", "by_when": "Not specified", "priority": "high"},
        {"who": "Mike", "what": "Book room", "by_when": "Not specified", "priority": "medium"},
    ]


def test_extraction_handles_null_lists():
    assert normalise_extraction({"decisions": None}) == {"decisions": [], "action_items": []}


def test_sentiment_flags_are_strict_booleans():
    result = normalise_sentiment({
        "overall_sentiment": "Positive",
        "flags": {"has_conflict": "false", "has_enthusiasm": True},
    })
    assert result["overall_sentiment"] == "positive"
    assert result["flags"] == {
        "has_conflict": False, "has_strong_agreement": False,
        "has_frustration": False, "has_enthusiasm": True,
    }
    assert result["speaker_sentiments"] == [] and result["segments"] == []
