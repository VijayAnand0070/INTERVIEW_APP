import base64
import os
import re
import subprocess
import tempfile
import wave
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable

from app.core.config import get_settings


def _read_audio_response(path: str, provider: str) -> Dict:
    with open(path, "rb") as audio_file:
        audio_base64 = base64.b64encode(audio_file.read()).decode("utf-8")
    return {
        "audio_base64": audio_base64,
        "mime_type": "audio/wav",
        "provider": provider,
    }


def _clean_tts_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    cleaned = cleaned.replace("→", " to ").replace("•", ". ")
    cleaned = re.sub(r"([.!?]){2,}", r"\1", cleaned)
    return cleaned


def _split_tts_text(text: str) -> list[str]:
    settings = get_settings()
    max_chars = max(120, settings.tts_max_chunk_chars)
    cleaned = _clean_tts_text(text)
    if len(cleaned) <= max_chars:
        return [cleaned] if cleaned else []

    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(sentence) > max_chars:
            words = sentence.split()
            for word in words:
                next_text = f"{current} {word}".strip()
                if len(next_text) > max_chars and current:
                    chunks.append(current)
                    current = word
                else:
                    current = next_text
            continue

        next_text = f"{current} {sentence}".strip()
        if len(next_text) > max_chars and current:
            chunks.append(current)
            current = sentence
        else:
            current = next_text

    if current:
        chunks.append(current)

    return chunks


def _temp_wav_path() -> str:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
        return temp_audio.name


def _silence_frames(params: wave._wave_params, duration_ms: int) -> bytes:
    sample_width = params.sampwidth
    channels = params.nchannels
    frame_rate = params.framerate
    frame_count = int(frame_rate * max(0, duration_ms) / 1000)
    return b"\x00" * frame_count * sample_width * channels


def _concat_wavs(paths: Iterable[str], output_path: str) -> None:
    paths = list(paths)
    if not paths:
        return

    settings = get_settings()
    with wave.open(paths[0], "rb") as first:
        params = first.getparams()
        first_frames = first.readframes(first.getnframes())

    with wave.open(output_path, "wb") as output:
        output.setparams(params)
        output.writeframes(first_frames)
        silence = _silence_frames(params, settings.tts_pause_ms)

        for path in paths[1:]:
            with wave.open(path, "rb") as source:
                source_params = source.getparams()
                if (
                    source_params.nchannels != params.nchannels
                    or source_params.sampwidth != params.sampwidth
                    or source_params.framerate != params.framerate
                ):
                    raise RuntimeError("TTS chunk audio formats did not match")
                output.writeframes(silence)
                output.writeframes(source.readframes(source.getnframes()))


def _xtts_gpu_enabled() -> bool:
    settings = get_settings()
    mode = settings.xtts_use_gpu.lower()
    if mode in {"1", "true", "yes", "cuda"}:
        return True
    if mode in {"0", "false", "no", "cpu"}:
        return False

    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


@lru_cache(maxsize=1)
def _xtts_model():
    settings = get_settings()
    if settings.coqui_tos_agreed != "1":
        raise RuntimeError(
            "Set COQUI_TOS_AGREED=1 after reviewing the Coqui Public Model License."
        )

    os.environ["COQUI_TOS_AGREED"] = "1"

    _allow_trusted_xtts_checkpoint_classes()

    from TTS.api import TTS

    return TTS(settings.xtts_model_name, gpu=_xtts_gpu_enabled())


def _allow_trusted_xtts_checkpoint_classes() -> None:
    try:
        import torch
        from TTS.config.shared_configs import BaseDatasetConfig
        from TTS.tts.configs.xtts_config import XttsConfig
        from TTS.tts.models.xtts import XttsArgs, XttsAudioConfig

        torch.serialization.add_safe_globals(
            [XttsConfig, XttsArgs, XttsAudioConfig, BaseDatasetConfig]
        )
    except Exception as error:
        print(f"Could not pre-register XTTS checkpoint classes: {error}")


def _coqui_xtts_tts(text: str) -> Dict | None:
    settings = get_settings()
    if settings.coqui_tos_agreed != "1":
        return None

    output_path = _temp_wav_path()
    chunk_paths: list[str] = []
    try:
        model = _xtts_model()
        speaker_wav = Path(settings.xtts_speaker_wav)
        chunks = _split_tts_text(text)
        if not chunks:
            return None

        for index, chunk in enumerate(chunks):
            chunk_path = output_path if len(chunks) == 1 else _temp_wav_path()
            chunk_paths.append(chunk_path)
            kwargs = {
                "text": chunk,
                "file_path": chunk_path,
                "language": settings.xtts_language,
                "split_sentences": True,
            }

            if speaker_wav.exists():
                kwargs["speaker_wav"] = [str(speaker_wav)]
            else:
                kwargs["speaker"] = settings.xtts_speaker

            model.tts_to_file(**kwargs)

        if len(chunk_paths) > 1:
            _concat_wavs(chunk_paths, output_path)

        if os.path.getsize(output_path) == 0:
            return None
        response = _read_audio_response(output_path, "coqui_xtts_v2")
        response["chunk_count"] = len(chunks)
        return response
    except Exception as error:
        print(f"Coqui XTTS-v2 failed, falling back to the next TTS provider: {error}")
        return None
    finally:
        for path in set([output_path, *chunk_paths]):
            if os.path.exists(path):
                os.remove(path)


def _piper_tts(text: str) -> Dict | None:
    settings = get_settings()
    voice_path = Path(settings.piper_voice_path)
    if not settings.piper_binary or not voice_path.exists():
        return None

    output_path = _temp_wav_path()
    try:
        subprocess.run(
            [settings.piper_binary, "--model", str(voice_path), "--output_file", output_path],
            input=_clean_tts_text(text).encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return _read_audio_response(output_path, "piper")
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)


def _pyttsx3_tts(text: str) -> Dict | None:
    try:
        import pyttsx3
    except Exception:
        return None

    output_path = _temp_wav_path()
    try:
        engine = pyttsx3.init()
        voices = engine.getProperty("voices")
        for voice in voices:
            if any(term in voice.name.lower() for term in ["female", "zira", "samantha", "jenny", "aria"]):
                engine.setProperty("voice", voice.id)
                break
        engine.setProperty("rate", 165)
        engine.save_to_file(_clean_tts_text(text), output_path)
        engine.runAndWait()
        if os.path.getsize(output_path) == 0:
            return None
        return _read_audio_response(output_path, "pyttsx3")
    except Exception:
        return None
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)


def synthesize(text: str, voice: str = "female_recruiter") -> Dict:
    settings = get_settings()
    clean_text = _clean_tts_text(text)
    if not clean_text:
        return {"audio_base64": None, "mime_type": None, "provider": "none"}

    provider = settings.tts_provider.lower()
    if provider in {"browser", "browser_fallback", "none", "off", "disabled"}:
        return {
            "audio_base64": None,
            "mime_type": None,
            "provider": "browser_fallback",
            "message": "Client browser voice is used for Sarah.",
        }

    if provider in {"xtts", "coqui", "coqui_xtts", "coqui_xtts_v2"}:
        response = _coqui_xtts_tts(clean_text)
        if response:
            return response

    if provider == "piper" or provider in {"xtts", "coqui", "coqui_xtts", "coqui_xtts_v2"}:
        response = _piper_tts(clean_text)
        if response:
            return response

    response = _pyttsx3_tts(clean_text)
    if response:
        return response

    return {
        "audio_base64": None,
        "mime_type": None,
        "provider": "browser_fallback",
        "message": "Configure Coqui XTTS-v2 or Piper for server-side natural voice generation.",
    }


def tts_readiness() -> Dict:
    settings = get_settings()
    if settings.tts_provider.lower() in {"browser", "browser_fallback", "none", "off", "disabled"}:
        return {
            "provider": settings.tts_provider,
            "xtts": {"ready": False},
            "piper": {"ready": False},
            "browser_fallback": {
                "ready": True,
                "note": "Client browser voice is used for Sarah.",
            },
        }

    speaker_wav = Path(settings.xtts_speaker_wav)
    piper_voice = Path(settings.piper_voice_path)
    xtts_package_available = True
    torch_cuda_available = False

    try:
        import TTS  # noqa: F401
    except Exception:
        xtts_package_available = False

    try:
        import torch

        torch_cuda_available = bool(torch.cuda.is_available())
    except Exception:
        torch_cuda_available = False

    xtts_ready = (
        settings.tts_provider.lower() in {"xtts", "coqui", "coqui_xtts", "coqui_xtts_v2"}
        and settings.coqui_tos_agreed == "1"
        and xtts_package_available
    )

    return {
        "provider": settings.tts_provider,
        "xtts": {
            "ready": xtts_ready,
            "package_available": xtts_package_available,
            "license_accepted": settings.coqui_tos_agreed == "1",
            "model": settings.xtts_model_name,
            "speaker": settings.xtts_speaker,
            "speaker_wav_exists": speaker_wav.exists(),
            "speaker_wav_path": str(speaker_wav),
            "gpu_mode": settings.xtts_use_gpu,
            "cuda_available": torch_cuda_available,
            "max_chunk_chars": settings.tts_max_chunk_chars,
            "pause_ms": settings.tts_pause_ms,
        },
        "piper": {
            "ready": piper_voice.exists(),
            "binary": settings.piper_binary,
            "voice_path": str(piper_voice),
        },
        "browser_fallback": {
            "ready": True,
            "note": "Available in supported browsers when server TTS is not ready.",
        },
    }
