"""Provider-agnostic LLM client.

Gemini and OpenRouter both expose an OpenAI-compatible `/chat/completions` endpoint,
so one small HTTP client covers both. Switching model/provider = changing env vars.
The `mock` provider needs no key: the chatbot builds a grounded answer from the
retrieved documents (used for offline demos, CI tests and as a fallback on errors).
"""
from __future__ import annotations

import logging
import time

import httpx

from .config import settings

ENDPOINTS = {
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
}

FREE_OPENROUTER_MODELS = [
    {"id": "openrouter/free", "label": "Auto", "tag": "Recommended", "vision": True},
    {"id": "google/gemma-4-31b-it:free", "label": "Gemma 4 31B", "tag": "Google · Vision", "vision": True},
    {"id": "google/gemma-4-26b-a4b-it:free", "label": "Gemma 4 26B", "tag": "Google · Fast", "vision": True},
    {"id": "nvidia/nemotron-3.5-super-vl:free", "label": "Nemotron 3.5 Super VL", "tag": "NVIDIA · Vision", "vision": True},
    {"id": "nvidia/nemotron-3.5-lightning:free", "label": "Nemotron 3.5 Lightning", "tag": "NVIDIA · Fast", "vision": False},
    {"id": "nvidia/nemotron-3-ultra-550b-a55b:free", "label": "Nemotron 3 Ultra 550B", "tag": "NVIDIA · Smart", "vision": False},
]

ALLOWED_FREE_MODEL_IDS = {m["id"] for m in FREE_OPENROUTER_MODELS}


class LLMError(Exception):
    pass


def provider_label() -> str:
    return f"{settings.llm_provider}:{settings.llm_model}"


def is_mock() -> bool:
    if settings.llm_provider == "mock":
        return True
    key = settings.gemini_api_key if settings.llm_provider == "gemini" else settings.openrouter_api_key
    return not key  # no key configured -> behave as mock


log = logging.getLogger("gymbuddy.llm")

# Remembers the last error so /api/health?check_llm=1 and the logs can explain a fallback.
last_error: str = ""


def _extract_content(data: dict) -> str:
    """Return the assistant text. Some free reasoning models put text only in `reasoning`
    or return `content` as a list of parts; handle those instead of treating them as empty."""
    msg = ((data.get("choices") or [{}])[0] or {}).get("message") or {}
    content = msg.get("content")
    if isinstance(content, list):
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return (content or "").strip()


def _call_once(provider: str, key: str, model: str, messages: list[dict], temperature: float, max_tokens: int) -> str:
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if provider == "openrouter":
        headers["HTTP-Referer"] = "https://gymbuddy-ai.vercel.app"
        headers["X-Title"] = "GymBuddy AI"
    payload = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    if provider == "openrouter":
        # Free OpenRouter models are mostly "reasoning" models: they spend tokens thinking before
        # writing the answer. Keep the thinking short and leave room for the visible answer,
        # otherwise the reply is cut off or empty (finish_reason "length").
        payload["max_tokens"] = max_tokens + settings.llm_reasoning_budget
        payload["reasoning"] = {"effort": "low", "exclude": True}
    try:
        r = httpx.post(ENDPOINTS[provider], json=payload, headers=headers, timeout=settings.llm_timeout)
    except httpx.HTTPError as e:
        raise LLMError(f"{model}: network error: {e}") from e
    if r.status_code >= 400:
        raise LLMError(f"{model}: HTTP {r.status_code}: {r.text[:300]}")
    try:
        data = r.json()
    except ValueError as e:
        raise LLMError(f"{model}: invalid JSON response") from e
    if data.get("error"):
        raise LLMError(f"{model}: {str(data['error'])[:300]}")
    content = _extract_content(data)
    if not content:
        raise LLMError(f"{model}: empty response")
    return content


def candidate_models(model_override: str | None = None) -> list[str]:
    """Primary model first, then the configured fallbacks (OpenRouter free models get rate-limited often)."""
    first = model_override or settings.llm_model
    chain = [first]
    if settings.llm_provider == "openrouter":
        chain += settings.llm_fallback_models
    seen: set[str] = set()
    return [m for m in chain if m and not (m in seen or seen.add(m))]


def chat(messages: list[dict], temperature: float | None = None, max_tokens: int = 900, model_override: str | None = None) -> str:
    """Send OpenAI-style messages, return the assistant text. Raises LLMError on failure."""
    return chat_with_model(messages, temperature, max_tokens, model_override)[0]


def chat_with_model(messages: list[dict], temperature: float | None = None, max_tokens: int = 900,
                    model_override: str | None = None) -> tuple[str, str]:
    """Like chat() but also returns the model that answered. Tries each candidate model in turn."""
    global last_error
    provider = settings.llm_provider
    if provider not in ENDPOINTS:
        raise LLMError(f"Provider '{provider}' has no remote endpoint")
    key = settings.gemini_api_key if provider == "gemini" else settings.openrouter_api_key
    if not key:
        raise LLMError(f"No API key configured for {provider}")
    temp = settings.llm_temperature if temperature is None else temperature

    errors: list[str] = []
    deadline = time.monotonic() + settings.llm_total_budget
    for model in candidate_models(model_override):
        if time.monotonic() > deadline:
            errors.append("time budget exhausted")
            break
        try:
            text = _call_once(provider, key, model, messages, temp, max_tokens)
            last_error = ""
            return text, model
        except LLMError as e:
            errors.append(str(e))
            log.warning("LLM call failed: %s", e)
            if " HTTP 401" in str(e) or " HTTP 402" in str(e):
                break  # bad key / no credits: other models will fail the same way
    last_error = " | ".join(errors)[:1000]
    raise LLMError(last_error or "LLM request failed")


VISION_MODELS_OPENROUTER = [
    "openrouter/free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3.5-super-vl:free",
]


def chat_vision(messages: list[dict], max_tokens: int = 800) -> tuple[str, str]:
    """Call a vision-capable model (returns (reply_text, model_used))."""
    if settings.llm_provider == "gemini":
        return chat(messages, max_tokens=max_tokens), f"gemini:{settings.llm_model}"
    if settings.llm_provider == "openrouter":
        key = settings.openrouter_api_key
        if not key:
            raise LLMError("No API key configured for openrouter")
        errors: list[str] = []
        for model in VISION_MODELS_OPENROUTER:
            try:
                return _call_once("openrouter", key, model, messages, settings.llm_temperature, max_tokens), f"openrouter:{model}"
            except LLMError as e:
                errors.append(str(e))
                log.warning("Vision call failed: %s", e)
        raise LLMError(" | ".join(errors)[:1000] or "No vision model succeeded")
    raise LLMError("Vision requires gemini or openrouter provider")


def _shrink_data_url(data_url: str, max_side: int = 640, quality: int = 78) -> str:
    """Downscale a base64 image to a small JPEG so it fits in an API response (Vercel limit 4.5 MB)."""
    if not data_url.startswith("data:image/"):
        return data_url
    try:
        import base64
        import io

        from PIL import Image

        raw = base64.b64decode(data_url.split(",", 1)[1])
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        img.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=quality, optimize=True)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return data_url


def generate_meal_image(meal_description: str) -> str:
    url = _generate_meal_image_raw(meal_description)
    return _shrink_data_url(url) if url else ""


def _generate_meal_image_raw(meal_description: str) -> str:
    """Generate an appetizing dish photo via OpenRouter (Recraft V4.1 Flash V2 free).

    Uses IMAGE_GEN_API_KEY if set, otherwise falls back to OPENROUTER_API_KEY.
    Returns an image URL or data:image/... URI, or '' on failure.
    """
    key = settings.image_gen_api_key or settings.openrouter_api_key
    model = settings.image_gen_model or "recraft/recraft-v4.1-flash-v2:free"
    if not key or settings.llm_provider == "mock":
        return ""

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gymbuddy-ai-phi.vercel.app",
        "X-Title": "GymBuddy AI",
    }
    prompt = (
        f"Overhead editorial food photography of a healthy fitness plate: {meal_description[:240]}. "
        "Natural daylight, ceramic plate on a clean stone table, appetizing, crisp focus, no text."
    )

    # 1) OpenRouter chat/completions. Recraft-style image-only models need modalities=["image"]
    for modalities in (["image"], ["image", "text"]):
        try:
            r = httpx.post(
                ENDPOINTS["openrouter"],
                headers=headers,
                json={
                    "model": model,
                    "modalities": modalities,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=60,
            )
            if r.status_code < 400:
                data = r.json()
                msg = (data.get("choices") or [{}])[0].get("message") or {}
                for img in msg.get("images") or []:
                    url = (img.get("image_url") or {}).get("url") or img.get("url")
                    if url:
                        return url
                content = msg.get("content")
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict):
                            url = (part.get("image_url") or {}).get("url") or part.get("url")
                            if url:
                                return url
        except Exception:
            continue

    # 2) Fallback: OpenAI-compatible /images/generations endpoint
    try:
        r = httpx.post(
            "https://openrouter.ai/api/v1/images/generations",
            headers=headers,
            json={"model": model, "prompt": prompt, "n": 1, "size": "1024x1024"},
            timeout=45,
        )
        if r.status_code < 400:
            item = (r.json().get("data") or [{}])[0]
            if item.get("url"):
                return item["url"]
            if item.get("b64_json"):
                return f"data:image/png;base64,{item['b64_json']}"
    except Exception:
        pass

    return ""


