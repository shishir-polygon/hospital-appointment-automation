"""
AI Service — FastAPI application
Voice interface: browser mic → Groq Whisper STT → Groq LLaMA LLM → edge-tts → browser audio
Twilio phone call system is commented out (enable later when needed).
"""
import base64
import os
import uuid
import structlog
import redis.asyncio as aioredis
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import get_settings
from services.groq_service import GroqService
from services.tts_service import TTSService
from services.conversation_manager import ConversationManager

logger = structlog.get_logger()
settings = get_settings()

AUDIO_DIR = "/tmp/tts_cache"
os.makedirs(AUDIO_DIR, exist_ok=True)

redis_client: aioredis.Redis = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    try:
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=False)
        await redis_client.ping()
        logger.info("redis_connected")
    except Exception as e:
        logger.warning("redis_unavailable", error=str(e))
        redis_client = None
    logger.info("ai_service_started")
    yield
    if redis_client:
        await redis_client.aclose()


app = FastAPI(title="AI Doctor Booking — Voice Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

tts_service = TTSService()
groq_service = GroqService()


def get_manager() -> ConversationManager:
    return ConversationManager(redis_client)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-doctor-voice"}


# ─── Voice Conversation API ───────────────────────────────────────────────────

class StartRequest(BaseModel):
    hospital_id: int | None = None
    caller_number: str = "web_user"
    language: str = "en"


class StartResponse(BaseModel):
    session_id: str
    greeting: str
    audio_base64: str
    language: str
    doctors: list = []
    hospital_name: str = ""


@app.post("/api/conversation/start", response_model=StartResponse)
async def start_conversation(body: StartRequest):
    """Create a new session, fetch available doctors, return greeting + audio."""
    import asyncio
    from services import db_service as db

    session_id = str(uuid.uuid4())
    manager = get_manager()
    session = await manager.get_or_create_session(session_id, body.caller_number, body.hospital_id)
    session.language = body.language
    await manager._save_session(session)

    # Fetch doctors for the selected hospital
    loop = asyncio.get_event_loop()
    doctors = []
    hospital_name = ""
    try:
        doctors = await loop.run_in_executor(
            None,
            lambda: db.search_doctors(hospital_id=body.hospital_id, limit=10)
        )
        if body.hospital_id:
            hospitals = await loop.run_in_executor(None, db.get_hospitals)
            h = next((x for x in hospitals if x["id"] == body.hospital_id), None)
            hospital_name = h["name"] if h else ""
    except Exception as e:
        logger.warning("greeting_context_failed", error=str(e))

    greeting = _get_greeting_with_doctors(body.language, doctors, hospital_name)
    audio_bytes = await tts_service.synthesize(greeting, body.language)

    return StartResponse(
        session_id=session_id,
        greeting=greeting,
        audio_base64=base64.b64encode(audio_bytes).decode(),
        language=body.language,
        doctors=doctors,
        hospital_name=hospital_name,
    )


class AudioTurnResponse(BaseModel):
    transcript: str
    response_text: str
    audio_base64: str
    language: str
    stage: str


@app.post("/api/conversation/audio-turn", response_model=AudioTurnResponse)
async def audio_conversation_turn(
    audio: UploadFile = File(...),
    session_id: str = Form(...),
    hospital_id: str = Form(None),
    language: str = Form("en"),
):
    """
    Receive an audio blob from the browser microphone,
    transcribe it, run through the conversation engine,
    and return the AI response as text + MP3 audio.
    """
    try:
        audio_data = await audio.read()
        if not audio_data:
            raise HTTPException(status_code=400, detail="Empty audio")

        # STT
        transcript = await groq_service.transcribe_audio(audio_data, language)
        if not transcript.strip():
            empty_reply = _get_reprompt(language)
            audio_bytes = await tts_service.synthesize(empty_reply, language)
            return AudioTurnResponse(
                transcript="",
                response_text=empty_reply,
                audio_base64=base64.b64encode(audio_bytes).decode(),
                language=language,
                stage="intent_detection",
            )

        # Conversation turn
        manager = get_manager()
        hosp_id = int(hospital_id) if hospital_id and hospital_id.isdigit() else None
        ai_text = await manager.process_turn(
            call_sid=session_id,
            user_text=transcript,
            caller_number="web_user",
            hospital_id=hosp_id,
        )
        session = await manager.get_or_create_session(session_id, "web_user", hosp_id)
        audio_bytes = await tts_service.synthesize(ai_text, session.language)

        return AudioTurnResponse(
            transcript=transcript,
            response_text=ai_text,
            audio_base64=base64.b64encode(audio_bytes).decode(),
            language=session.language,
            stage=session.stage.value,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("audio_turn_error", error=str(e))
        lang = language or "bn"
        err_msgs = {
            "bn": "দুঃখিত, একটি ত্রুটি হয়েছে। আবার চেষ্টা করুন।",
            "en": "Sorry, an error occurred. Please try again.",
            "hi": "क्षमा करें, कोई त्रुटि हुई। कृपया पुनः प्रयास करें।",
        }
        reply = err_msgs.get(lang, err_msgs["en"])
        audio_bytes = await tts_service.synthesize(reply, lang)
        return AudioTurnResponse(
            transcript="",
            response_text=reply,
            audio_base64=base64.b64encode(audio_bytes).decode(),
            language=lang,
            stage="intent_detection",
        )


class TextTurnRequest(BaseModel):
    session_id: str
    message: str
    hospital_id: int | None = None
    caller_number: str = "web_user"


class TextTurnResponse(BaseModel):
    response_text: str
    audio_base64: str
    language: str
    stage: str
    context: dict = {}
    appointment: dict | None = None


@app.post("/api/conversation/turn", response_model=TextTurnResponse)
async def text_conversation_turn(body: TextTurnRequest):
    """Text-only conversation turn (for testing without mic)."""
    manager = get_manager()
    ai_text = await manager.process_turn(
        call_sid=body.session_id,
        user_text=body.message,
        caller_number=body.caller_number,
        hospital_id=body.hospital_id,
    )
    session = await manager.get_or_create_session(body.session_id, body.caller_number, body.hospital_id)
    audio_bytes = await tts_service.synthesize(ai_text, session.language)

    # Build context for UI (doctors list if available)
    ctx = {}
    try:
        import asyncio
        from services import db_service as db
        loop = asyncio.get_event_loop()
        if session.booking_data.doctor_id:
            doc = await loop.run_in_executor(None, db.get_doctor, session.booking_data.doctor_id)
            if doc:
                ctx["doctors"] = [doc]
        elif session.booking_data.doctor_name or session.booking_data.department:
            docs = await loop.run_in_executor(
                None, lambda: db.search_doctors(
                    hospital_id=session.hospital_id or body.hospital_id,
                    search=session.booking_data.doctor_name,
                    department=session.booking_data.department,
                    limit=3,
                )
            )
            if docs:
                ctx["doctors"] = docs
    except Exception:
        pass

    return TextTurnResponse(
        response_text=ai_text,
        audio_base64=base64.b64encode(audio_bytes).decode(),
        language=session.language,
        stage=session.stage.value,
        context=ctx,
        appointment={"id": session.appointment_id} if session.appointment_id else None,
    )


@app.delete("/api/conversation/{session_id}")
async def end_conversation(session_id: str):
    """End and clean up a session."""
    manager = get_manager()
    await manager.end_session(session_id)
    return {"ended": True}


# ─── STT endpoint (standalone) ────────────────────────────────────────────────

@app.post("/api/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form("en"),
):
    """Transcribe audio to text using Groq Whisper."""
    audio_data = await audio.read()
    text = await groq_service.transcribe_audio(audio_data, language)
    return {"text": text, "language": language}


# ─── Audio file serving ────────────────────────────────────────────────────────

@app.get("/audio/{filename}")
async def serve_audio(filename: str):
    path = os.path.join(AUDIO_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type="audio/mpeg")


# ─── Built-in Voice Demo UI ───────────────────────────────────────────────────

@app.get("/api/hospitals")
async def list_hospitals():
    """Return all active hospitals for the UI selector."""
    import asyncio
    from services import db_service as db
    loop = asyncio.get_event_loop()
    try:
        hospitals = await loop.run_in_executor(None, db.get_hospitals)
        return {"hospitals": hospitals}
    except Exception as e:
        logger.warning("hospitals_fetch_failed", error=str(e))
        return {"hospitals": []}


@app.get("/", response_class=HTMLResponse)
async def voice_demo():
    """Serve the browser-based voice demo page."""
    with open(os.path.join(os.path.dirname(__file__), "static", "index.html")) as f:
        return HTMLResponse(f.read())


# ─── Twilio webhooks (COMMENTED OUT — enable when ready for phone calls) ─────
# from services.twilio_handler import build_twiml_play_and_gather, ...
#
# @app.post("/twilio/incoming")
# async def handle_incoming_call(...):
#     ...
#
# @app.post("/twilio/gather")
# async def handle_speech_input(...):
#     ...
#
# @app.post("/twilio/status")
# async def handle_call_status(...):
#     ...


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_greeting_with_doctors(language: str, doctors: list, hospital_name: str) -> str:
    """Build a greeting that mentions available doctors from the selected hospital."""
    if not doctors:
        base = {
            "en": "Welcome to AI Doctor Booking! You can book an appointment, check queue status, or ask about our doctors. How can I help?",
            "bn": "এআই ডক্টর বুকিং সিস্টেমে আপনাকে স্বাগতম! অ্যাপয়েন্টমেন্ট বুক করতে, সিরিয়াল জানতে, বা ডাক্তারের তথ্য পেতে বলুন।",
            "hi": "AI डॉक्टर बुकिंग में आपका स्वागत है! अपॉइंटमेंट बुक करें, कतार की जाँच करें या डॉक्टर की जानकारी लें।",
            "ar": "مرحباً بك! يمكنك حجز موعد أو الاستفسار عن الأطباء.",
        }
        return base.get(language, base["en"])

    # Build doctor list (max 3) for the greeting
    top = doctors[:3]
    if language == "bn":
        names = "، ".join(f"{d['title']} {d['name']} ({d.get('department','')}, ৳{d.get('consultation_fee','')})" for d in top)
        hosp = f"{hospital_name}-এ " if hospital_name else ""
        return (
            f"এআই ডক্টর বুকিং সিস্টেমে আপনাকে স্বাগতম! "
            f"{hosp}আজকের উপলব্ধ ডাক্তারগণ: {names}। "
            f"অ্যাপয়েন্টমেন্ট বুক করতে, সিরিয়াল নম্বর জানতে বা অন্য কিছু জানতে বলুন।"
        )
    elif language == "hi":
        names = ", ".join(f"{d['title']} {d['name']} ({d.get('department','')})" for d in top)
        return f"AI Doctor Booking में आपका स्वागत है! उपलब्ध डॉक्टर: {names}। अपॉइंटमेंट बुक करने के लिए बोलें।"
    else:
        names = ", ".join(f"{d['title']} {d['name']} ({d.get('department','')}, ৳{d.get('consultation_fee','')})" for d in top)
        hosp = f" at {hospital_name}" if hospital_name else ""
        return (
            f"Welcome to AI Doctor Booking{hosp}! "
            f"Available doctors: {names}. "
            f"Say a doctor's name to book an appointment, or ask about queue status."
        )


def _get_greeting(language: str = "en") -> str:
    return _get_greeting_with_doctors(language, [], "")


def _get_reprompt(language: str = "en") -> str:
    reprompts = {
        "en": "I didn't catch that. Could you please speak again?",
        "bn": "বুঝতে পারিনি। একটু আবার বলবেন?",
        "hi": "समझ नहीं आया। कृपया दोबारा बोलें।",
        "ar": "لم أسمعك جيداً. هل يمكنك التحدث مرة أخرى؟",
    }
    return reprompts.get(language, reprompts["en"])
