"""
TTS Service — Google TTS (gTTS) as primary, edge-tts as fallback.

edge-tts is blocked by Microsoft (403) from cloud/server IPs.
gTTS uses Google's TTS, which works reliably from any IP, no API key needed.
"""
import asyncio
import hashlib
import io
import os
import structlog

from config import get_settings

logger = structlog.get_logger()
settings = get_settings()

CACHE_DIR = "/tmp/tts_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# gTTS language codes
GTTS_LANG_MAP = {
    "en": "en",
    "bn": "bn",
    "hi": "hi",
    "ar": "ar",
}

# edge-tts voices (used as fallback)
EDGE_VOICE_MAP = {
    "en": settings.tts_voice_en,
    "bn": settings.tts_voice_bn,
    "hi": settings.tts_voice_hi,
    "ar": settings.tts_voice_ar,
}


def _gtts_synthesize(text: str, lang: str) -> bytes:
    """Synchronous gTTS synthesis — run in executor."""
    from gtts import gTTS
    tts = gTTS(text=text, lang=lang, slow=False)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return buf.read()


async def _edge_tts_synthesize(text: str, voice: str) -> bytes:
    """edge-tts synthesis — may 403 on cloud IPs."""
    import edge_tts
    communicate = edge_tts.Communicate(text, voice)
    chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


class TTSService:
    """Text-to-Speech: gTTS primary, edge-tts fallback."""

    async def synthesize(self, text: str, language: str = "en") -> bytes:
        """Convert text to MP3 bytes."""
        lang = GTTS_LANG_MAP.get(language, "en")
        cache_key = hashlib.md5(f"gtts:{lang}:{text}".encode()).hexdigest()
        cache_path = os.path.join(CACHE_DIR, f"{cache_key}.mp3")

        if os.path.exists(cache_path):
            with open(cache_path, "rb") as f:
                return f.read()

        audio_data = await self._try_gtts(text, lang)

        if not audio_data:
            logger.warning("gtts_failed_trying_edge_tts", language=language)
            audio_data = await self._try_edge_tts(text, language)

        if not audio_data:
            logger.error("all_tts_failed", language=language)
            # Return a minimal silent MP3 so the app doesn't crash
            audio_data = _silent_mp3()

        with open(cache_path, "wb") as f:
            f.write(audio_data)

        logger.info("tts_synthesized", language=language, bytes=len(audio_data))
        return audio_data

    async def _try_gtts(self, text: str, lang: str) -> bytes | None:
        try:
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(None, _gtts_synthesize, text, lang)
            if data:
                logger.info("tts_gtts_ok", lang=lang, chars=len(text))
                return data
        except Exception as e:
            logger.warning("tts_gtts_error", error=str(e))
        return None

    async def _try_edge_tts(self, text: str, language: str) -> bytes | None:
        try:
            voice = EDGE_VOICE_MAP.get(language, settings.tts_voice_en)
            data = await _edge_tts_synthesize(text, voice)
            if data:
                logger.info("tts_edge_tts_ok", language=language)
                return data
        except Exception as e:
            logger.warning("tts_edge_tts_error", error=str(e))
        return None

    async def synthesize_to_file(self, text: str, language: str = "en", output_path: str = None) -> str:
        audio_data = await self.synthesize(text, language)
        if output_path is None:
            key = hashlib.md5(f"{text}{language}".encode()).hexdigest()
            output_path = os.path.join(CACHE_DIR, f"{key}.mp3")
        with open(output_path, "wb") as f:
            f.write(audio_data)
        return output_path


def _silent_mp3() -> bytes:
    """Minimal valid MP3 (1 second silence) so the app doesn't crash on TTS failure."""
    # ID3 header + minimal MPEG frame
    return bytes([
        0xFF, 0xFB, 0x90, 0x00,  # MPEG1 Layer3 128kbps 44100Hz
        *([0x00] * 413),          # ~1 second of silence
    ])
