import os
import re
import json
from groq import Groq, RateLimitError, APIStatusError

# Groq retires models periodically (llama-3.3-70b-versatile is gone), so the model is
# configurable without a code change. gpt-oss-120b: 131k context, strong at JSON output.
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

REASONING_HEADROOM = 2000

_client = None


def _is_reasoning_model() -> bool:
    return MODEL.startswith("openai/gpt-oss")


class LLMError(Exception):
    """Raised when the LLM provider can't be reached or rejects the request."""


def get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise LLMError("GROQ_API_KEY is not set on the server")
        _client = Groq(api_key=api_key)
    return _client


def ask_ai(prompt: str, system: str = None, max_tokens: int = 2000) -> str:
    """
    Sends a single-turn chat request to Groq and returns the reply text.
    max_tokens is the budget for the visible answer; reasoning models also spend
    tokens thinking, so extra headroom is added on top.
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    try:
        response = get_client().chat.completions.create(
            model=MODEL,
            max_tokens=max_tokens + REASONING_HEADROOM if _is_reasoning_model() else max_tokens,
            temperature=0.2,  # low temperature = more consistent, factual extraction
            messages=messages,
            **({"reasoning_effort": "low"} if _is_reasoning_model() else {}),
        )
    except LLMError:
        raise
    except (RateLimitError, APIStatusError) as e:
        if isinstance(e, RateLimitError) or e.status_code == 413:
            raise LLMError(
                "The AI provider's rate limit was reached (Groq free tier). "
                "Wait a minute and try again, or use a shorter transcript."
            ) from e
        raise LLMError(f"LLM request failed: {e}") from e
    except Exception as e:
        raise LLMError(f"LLM request failed: {e}") from e

    return response.choices[0].message.content or ""


def parse_json_response(text: str):
    """
    Pulls the JSON object out of an LLM reply. Models sometimes wrap JSON in prose
    or ```json fences despite instructions, so grab the outermost {...} span.
    Returns None if nothing parseable is found.
    """
    match = re.search(r"\{.*\}", text, re.DOTALL)
    try:
        return json.loads(match.group() if match else text)
    except json.JSONDecodeError:
        return None
