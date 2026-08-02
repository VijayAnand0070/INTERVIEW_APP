import os
from functools import lru_cache

from dotenv import load_dotenv

# Prefer the current project .env file over stale inherited shell variables.
load_dotenv(override=True)


class Settings:
    llm_provider: str = os.getenv("LLM_PROVIDER", "groq").lower()
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    # Dedicated high-power model for final evaluation report generation
    groq_report_model: str = os.getenv("GROQ_REPORT_MODEL", "llama-3.3-70b-versatile")
    groq_stt_model: str = os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")
    groq_base_url: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    groq_timeout_seconds: float = float(os.getenv("GROQ_TIMEOUT_SECONDS", "60"))
    stt_provider: str = os.getenv("STT_PROVIDER", "groq").lower()
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "local-model")
    ollama_model_fallbacks: list[str] = [
        value.strip()
        for value in os.getenv(
            "OLLAMA_MODEL_FALLBACKS",
            "",
        ).split(",")
        if value.strip()
    ]
    ollama_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180"))
    ollama_num_ctx: int = int(os.getenv("OLLAMA_NUM_CTX", "4096"))
    ollama_num_predict: int = int(os.getenv("OLLAMA_NUM_PREDICT", "1200"))
    whisper_model: str = os.getenv("WHISPER_MODEL", "base")
    whisper_device: str = os.getenv("WHISPER_DEVICE", "auto")
    tts_provider: str = os.getenv("TTS_PROVIDER", "piper")
    tts_max_chunk_chars: int = int(os.getenv("TTS_MAX_CHUNK_CHARS", "360"))
    tts_pause_ms: int = int(os.getenv("TTS_PAUSE_MS", "180"))
    piper_binary: str = os.getenv("PIPER_BINARY", "piper")
    piper_voice_path: str = os.getenv("PIPER_VOICE_PATH", "./voices/en_US-lessac-medium.onnx")
    coqui_tos_agreed: str = os.getenv("COQUI_TOS_AGREED", "0")
    xtts_model_name: str = os.getenv(
        "XTTS_MODEL_NAME",
        "tts_models/multilingual/multi-dataset/xtts_v2",
    )
    xtts_speaker: str = os.getenv("XTTS_SPEAKER", "Ana Florence")
    xtts_speaker_wav: str = os.getenv("XTTS_SPEAKER_WAV", "./voices/female_recruiter.wav")
    xtts_language: str = os.getenv("XTTS_LANGUAGE", "en")
    xtts_use_gpu: str = os.getenv("XTTS_USE_GPU", "auto")


@lru_cache
def get_settings() -> Settings:
    return Settings()
