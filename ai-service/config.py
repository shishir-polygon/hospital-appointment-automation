from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    groq_api_key: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    backend_api_url: str = "http://localhost:8000/api/v1"
    backend_api_secret: str = "change_this_secret_key"
    redis_url: str = "redis://localhost:6379"
    database_url: str = "host=postgres port=5432 dbname=ai_doctor user=postgres password=secret"

    # Groq model config
    # 70B for response generation (quality), 8B for intent/extraction (higher RPD limit)
    llm_model: str = "llama-3.3-70b-versatile"
    llm_fast_model: str = "llama-3.1-8b-instant"
    stt_model: str = "whisper-large-v3"

    # TTS config (edge-tts voices)
    tts_voice_en: str = "en-US-JennyNeural"
    tts_voice_bn: str = "bn-BD-NabanitaNeural"
    tts_voice_hi: str = "hi-IN-SwaraNeural"
    tts_voice_ar: str = "ar-EG-SalmaNeural"

    # Conversation limits
    max_conversation_turns: int = 20
    session_ttl_seconds: int = 3600

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
