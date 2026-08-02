import json
import re
import urllib.error
import urllib.request
from typing import Any

from app.core.config import get_settings


def _ollama_module():
    import ollama

    return ollama


def _groq_chat(messages: list[dict[str, str]]) -> str:
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    body = json.dumps(
        {
            "model": settings.groq_model,
            "messages": messages,
            "temperature": 0.2,
            "top_p": 0.9,
            "response_format": {"type": "json_object"},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{settings.groq_base_url.rstrip('/')}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "interview_agent/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=settings.groq_timeout_seconds) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["choices"][0]["message"]["content"]


def _client():
    settings = get_settings()
    ollama = _ollama_module()
    try:
        return ollama.Client(host=settings.ollama_host, timeout=settings.ollama_timeout_seconds)
    except TypeError:
        return ollama.Client(host=settings.ollama_host)


def _model_name(model: Any) -> str:
    if isinstance(model, dict):
        return str(model.get("name") or model.get("model") or "")
    return str(getattr(model, "name", "") or getattr(model, "model", ""))


def _available_models() -> list[str]:
    response = _client().list()
    raw_models = []

    if isinstance(response, dict):
        raw_models = response.get("models", [])
    else:
        raw_models = getattr(response, "models", [])

    return [name for name in (_model_name(model) for model in raw_models) if name]


def resolve_ollama_model() -> str:
    settings = get_settings()
    available = _available_models()
    candidates = [settings.ollama_model, *settings.ollama_model_fallbacks]

    for candidate in candidates:
        if candidate in available:
            return candidate

    for candidate in candidates:
        candidate_base = candidate.split(":")[0].lower()
        for model in available:
            if candidate_base and candidate_base in model.lower():
                return model

    return settings.ollama_model


def _balanced_json_candidate(text: str) -> str:
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        cleaned = fenced.group(1).strip()

    starts = [idx for idx in (cleaned.find("{"), cleaned.find("[")) if idx >= 0]
    if not starts:
        return cleaned

    start = min(starts)
    opener = cleaned[start]
    closer = "}" if opener == "{" else "]"
    depth = 0
    in_string = False
    escape = False

    for index in range(start, len(cleaned)):
        char = cleaned[index]

        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return cleaned[start:index + 1]

    return cleaned[start:]


def extract_json(text: str) -> Any:
    return json.loads(_balanced_json_candidate(text))


def _chat_payload(system_prompt: str, user_prompt: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                f"{system_prompt}\n"
                "Return strict valid JSON only. Do not include markdown or commentary."
            ),
        },
        {"role": "user", "content": user_prompt},
    ]


def chat_json(system_prompt: str, user_prompt: str, fallback: Any) -> Any:
    settings = get_settings()
    try:
        messages = _chat_payload(system_prompt, user_prompt)
        if settings.llm_provider == "groq":
            return extract_json(_groq_chat(messages))

        response = _client().chat(
            model=resolve_ollama_model(),
            messages=messages,
            format="json",
            keep_alive="10m",
            options={
                "temperature": 0.25,
                "top_p": 0.9,
                "repeat_penalty": 1.08,
                "num_ctx": settings.ollama_num_ctx,
                "num_predict": settings.ollama_num_predict,
            },
        )
        content = response["message"]["content"]
        return extract_json(content)
    except Exception as error:
        print(f"LLM provider failed, using fallback: {type(error).__name__}: {str(error)[:300]}")
        return fallback


def groq_readiness(model: str | None = None) -> dict:
    settings = get_settings()
    configured_model = model or settings.groq_model

    if not settings.groq_api_key:
        return {
            "ready": False,
            "provider": "groq",
            "configured_model": configured_model,
            "message": "Set GROQ_API_KEY",
        }

    request = urllib.request.Request(
        f"{settings.groq_base_url.rstrip('/')}/models",
        headers={
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Accept": "application/json",
            "User-Agent": "interview_agent/1.0",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=min(settings.groq_timeout_seconds, 8)) as response:
            payload = json.loads(response.read().decode("utf-8"))

        available_models = {
            str(item.get("id"))
            for item in payload.get("data", [])
            if isinstance(item, dict) and item.get("id")
        }
        model_available = not available_models or configured_model in available_models
        return {
            "ready": model_available,
            "provider": "groq",
            "configured_model": configured_model,
            "message": (
                "Groq API and configured model are ready"
                if model_available
                else "Configured Groq model is not available to this API key"
            ),
        }
    except urllib.error.HTTPError as error:
        return {
            "ready": False,
            "provider": "groq",
            "configured_model": configured_model,
            "message": f"Groq API verification failed (HTTP {error.code})",
        }
    except urllib.error.URLError as error:
        return {
            "ready": False,
            "provider": "groq",
            "configured_model": configured_model,
            "message": f"Groq API is unreachable: {error.reason}",
        }
    except Exception as error:
        return {
            "ready": False,
            "provider": "groq",
            "configured_model": configured_model,
            "message": f"Groq API verification failed: {type(error).__name__}",
        }


def llm_readiness() -> dict:
    settings = get_settings()
    if settings.llm_provider == "groq":
        return groq_readiness()
    return ollama_readiness()


def ollama_readiness() -> dict:
    settings = get_settings()
    try:
        available = _available_models()
        resolved = resolve_ollama_model()
        ready = resolved in available
        return {
            "ready": ready,
            "host": settings.ollama_host,
            "configured_model": settings.ollama_model,
            "resolved_model": resolved,
            "available_models": available,
            "message": "Local model ready" if ready else "Start the local model service",
        }
    except Exception as error:
        return {
            "ready": False,
            "host": settings.ollama_host,
            "configured_model": settings.ollama_model,
            "error": str(error),
        }
