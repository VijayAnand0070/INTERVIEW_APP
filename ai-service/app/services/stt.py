from functools import lru_cache
import json
from pathlib import Path
import uuid
from typing import Dict
import urllib.request

from app.core.config import get_settings
from app.services.llm import groq_readiness


@lru_cache(maxsize=1)
def whisper_model():
    from faster_whisper import WhisperModel

    settings = get_settings()
    device_order = ["cuda", "cpu"] if settings.whisper_device == "auto" else [settings.whisper_device]
    last_error = None

    for device in device_order:
        try:
            compute_type = "float16" if device == "cuda" else "int8"
            return WhisperModel(settings.whisper_model, device=device, compute_type=compute_type)
        except Exception as error:
            last_error = error

    raise RuntimeError(f"Could not load Whisper model: {last_error}")


def transcribe_audio(file_path: str) -> Dict:
    settings = get_settings()
    if settings.stt_provider == "groq":
        return transcribe_audio_groq(file_path)

    model = whisper_model()
    segments, info = model.transcribe(file_path, beam_size=5, vad_filter=True)
    transcription = " ".join(segment.text.strip() for segment in segments).strip()
    return {
        "transcription": transcription,
        "language": getattr(info, "language", None),
        "duration": getattr(info, "duration", None),
    }


def transcribe_audio_groq(file_path: str) -> Dict:
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    boundary = f"----pucca-groq-{uuid.uuid4().hex}"
    path = Path(file_path)
    file_bytes = path.read_bytes()
    filename = path.name or "answer.webm"
    mime_type = "audio/webm"

    parts = [
        (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="model"\r\n\r\n'
            f"{settings.groq_stt_model}\r\n"
        ).encode("utf-8"),
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode("utf-8"),
        file_bytes,
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ]
    body = b"".join(parts)
    request = urllib.request.Request(
        f"{settings.groq_base_url.rstrip('/')}/audio/transcriptions",
        data=body,
        headers={
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
            "Accept": "application/json",
            "User-Agent": "interview_agent/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=settings.groq_timeout_seconds) as response:
        payload = json.loads(response.read().decode("utf-8"))

    text = str(payload.get("text") or payload.get("transcription") or "").strip()
    return {
        "transcription": text,
        "language": payload.get("language"),
        "duration": payload.get("duration"),
        "provider": "groq",
        "model": settings.groq_stt_model,
    }


def stt_readiness(load_model: bool = False) -> Dict:
    settings = get_settings()
    if settings.stt_provider == "groq":
        return groq_readiness(settings.groq_stt_model)

    package_available = True
    try:
        import faster_whisper  # noqa: F401
    except Exception:
        package_available = False

    status = {
        "ready": package_available,
        "package_available": package_available,
        "configured_model": settings.whisper_model,
        "device": settings.whisper_device,
        "note": "Set load_model=true in code only when you want readiness to warm the model.",
    }

    if load_model:
        try:
            whisper_model()
        except Exception as error:
            status["ready"] = False
            status["error"] = str(error)

    return status
