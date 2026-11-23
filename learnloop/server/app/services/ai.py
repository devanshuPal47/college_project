"""Groq chat completions for the tutor chat and code feedback."""
import hashlib
import json
import logging
from collections import OrderedDict

import httpx

from app.core.config import get_settings
from app.core.errors import RateLimitedError, ServiceUnavailableError
from app.schemas.ai import ChatRequest, FeedbackRequest, FeedbackResponse

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

CHAT_BASE = (
    "You are LearnLoop's friendly coding tutor for absolute beginners. Be warm and concrete, at most ~130 words. "
    "Teach, don't solve: NEVER write the learner's complete solution or paste the exact code that makes their checks pass. "
    "Prefer a short question that makes them think. Use `inline code` and small ```fenced``` examples (not their exact task). "
    "Never invent URLs or library features. If you're unsure, say so."
)

# Research on AI programming tutors: orientation hints help, bottom-out hints (exact code) hurt learning,
# and learners should attempt the task before asking. The ladder below encodes that.
HINT_LADDER = {
    1: "HINT LEVEL 1 (nudge): point at the relevant concept or the part of their code to look at. No code at all.",
    2: "HINT LEVEL 2 (targeted): name the specific property/method/idea they need and why. At most a tiny generic example on a DIFFERENT topic than their task.",
    3: "HINT LEVEL 3 (walk-through): explain the concept step by step with a small analogous example. Still do not write their solution.",
}


def build_chat_system(req: ChatRequest) -> str:
    level = HINT_LADDER[req.hint_level]
    if req.attempts == 0:
        level += " The learner has NOT run the checks yet: encourage them to try first and press 'Check my work', and keep help conceptual."
    if req.mode == "challenge":
        level += " The learner chose CHALLENGE mode: keep hints extra brief and indirect."
    ctx = ""
    if req.project:
        ctx += f"\nProject: {req.project.get('title')}. Goal: {req.project.get('goal')}"
    if req.code:
        ctx += "".join(f"\n{k.upper()}:\n{str(req.code.get(k, ''))[:1500]}" for k in ("html", "css", "js"))
    if req.results:
        ctx += "\nCheck results: " + json.dumps(req.results)[:800]
    return f"{CHAT_BASE}\n{level}{ctx}"


FEEDBACK_SYSTEM = (
    "You review a beginner's web project. You get the project goal, their code and automated check results. "
    'Reply ONLY with JSON: {"strengths": [string, string?], "fixes": [string, string?], "next_step": string}. '
    "Max 2 strengths and max 2 fixes. Start from what works. Each fix must be specific and actionable "
    "and must NOT contain the complete solution. Warm, plain language. Never invent URLs."
)

_CACHE_MAX = 256
_feedback_cache: "OrderedDict[str, FeedbackResponse]" = OrderedDict()


def ensure_configured() -> None:
    if not get_settings().groq_api_key:
        raise ServiceUnavailableError("AI isn't configured yet. Ask an administrator to set GROQ_API_KEY.", code="ai_not_configured")


async def _complete(model: str, messages: list[dict], *, json_mode: bool = False) -> str:
    s = get_settings()
    body: dict = {"model": model, "messages": messages, "temperature": 0.4, "max_tokens": 1500}
    if model.startswith("openai/gpt-oss"):
        body["reasoning_effort"] = "low"  # these models think first; keep it quick
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(GROQ_URL, headers={"Authorization": f"Bearer {s.groq_api_key}"}, json=body)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"] or ""
    except httpx.HTTPStatusError as e:
        logger.warning("Groq returned %s: %s", e.response.status_code, e.response.text[:200])
        if e.response.status_code == 429:
            raise RateLimitedError("The AI is busy right now (shared free limit). Try again in a minute.", code="ai_busy") from None
        raise ServiceUnavailableError("The AI had a problem. Try again shortly.", code="ai_upstream_error") from None
    except (httpx.HTTPError, KeyError, ValueError):
        raise ServiceUnavailableError("Couldn't reach the AI. Check your connection and try again.", code="ai_unreachable") from None


async def chat(req: ChatRequest) -> str:
    messages = [{"role": "system", "content": build_chat_system(req)}] + [m.model_dump() for m in req.messages[-8:]]
    return await _complete(get_settings().groq_chat_model, messages)


def feedback_cache_key(req: FeedbackRequest) -> str:
    return hashlib.sha256(json.dumps(req.model_dump(), sort_keys=True).encode()).hexdigest()


def cached_feedback(key: str) -> FeedbackResponse | None:
    return _feedback_cache.get(key)


async def feedback(req: FeedbackRequest, key: str) -> FeedbackResponse:
    user_msg = (
        f"Goal: {req.project.get('goal')}\nTitle: {req.project.get('title')}\n"
        + "".join(f"{k.upper()}:\n{str(req.code.get(k, ''))[:2500]}\n" for k in ("html", "css", "js"))
        + f"Checks: {json.dumps(req.results)[:1200]}"
    )
    raw = await _complete(
        get_settings().groq_feedback_model,
        [{"role": "system", "content": FEEDBACK_SYSTEM}, {"role": "user", "content": user_msg}],
        json_mode=True,
    )
    try:
        data = json.loads(raw)
        result = FeedbackResponse(
            strengths=[str(x) for x in data.get("strengths", [])][:2],
            fixes=[str(x) for x in data.get("fixes", [])][:2],
            next_step=str(data.get("next_step", "")),
        )
    except (ValueError, AttributeError):
        raise ServiceUnavailableError("The AI gave an unusable answer. Try again.", code="ai_bad_response") from None
    _feedback_cache[key] = result
    if len(_feedback_cache) > _CACHE_MAX:
        _feedback_cache.popitem(last=False)
    return result
