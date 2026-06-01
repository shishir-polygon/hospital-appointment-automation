import json
import uuid
from datetime import datetime
import httpx
import redis.asyncio as aioredis
import structlog

from config import get_settings
from models.conversation import (
    ConversationSession, ConversationIntent, BookingStage,
    ConversationMessage, PatientInfo, BookingData
)
from services.groq_service import GroqService

logger = structlog.get_logger()
settings = get_settings()


_memory_store: dict = {}  # fallback when Redis is unavailable


class ConversationManager:
    def __init__(self, redis_client: aioredis.Redis | None):
        self.redis = redis_client
        self.groq = GroqService()

    # ──────────────────────────────────────────────────────────────────────────
    # Session management
    # ──────────────────────────────────────────────────────────────────────────

    async def get_or_create_session(self, call_sid: str, caller_number: str, hospital_id: int = None) -> ConversationSession:
        key = f"session:{call_sid}"
        data = await self._redis_get(key)
        if data:
            return ConversationSession.model_validate_json(data)

        session = ConversationSession(
            session_id=str(uuid.uuid4()),
            call_sid=call_sid,
            caller_number=caller_number,
            hospital_id=hospital_id,
            created_at=datetime.utcnow().isoformat(),
        )
        await self._save_session(session)
        return session

    async def _save_session(self, session: ConversationSession):
        session.updated_at = datetime.utcnow().isoformat()
        key = f"session:{session.call_sid}"
        await self._redis_set(key, session.model_dump_json(), settings.session_ttl_seconds)

    async def end_session(self, call_sid: str):
        key = f"session:{call_sid}"
        if self.redis:
            try:
                await self.redis.delete(key)
                return
            except Exception:
                pass
        _memory_store.pop(key, None)

    # ── Redis helpers with memory fallback ───────────────────────────────────

    async def _redis_get(self, key: str) -> bytes | None:
        if self.redis:
            try:
                return await self.redis.get(key)
            except Exception:
                pass
        return _memory_store.get(key)

    async def _redis_set(self, key: str, value: str, ttl: int):
        if self.redis:
            try:
                await self.redis.setex(key, ttl, value)
                return
            except Exception:
                pass
        _memory_store[key] = value

    # ──────────────────────────────────────────────────────────────────────────
    # Main conversation processing
    # ──────────────────────────────────────────────────────────────────────────

    async def process_turn(self, call_sid: str, user_text: str, caller_number: str, hospital_id: int = None) -> str:
        """Process one conversation turn. Returns AI response text."""
        session = await self.get_or_create_session(call_sid, caller_number, hospital_id)

        # Detect language (local — no API call)
        if not session.messages:
            session.language = await self.groq.detect_language(user_text)

        # Combined single LLM call: detect intent + extract fields in one request
        # This reduces API usage from 3 calls/turn to 2 calls/turn (or 1 on repeat turns)
        if session.stage in (BookingStage.GREETING, BookingStage.INTENT_DETECTION):
            combined = await self.groq.detect_intent_and_extract(user_text, session)
            try:
                session.intent = ConversationIntent(combined.get("intent", "general_inquiry"))
            except ValueError:
                session.intent = ConversationIntent.GENERAL_INQUIRY
            if combined.get("language"):
                session.language = combined["language"]
            # Apply extracted fields from the same call
            self._apply_extracted_fields(session, combined.get("fields", {}))
        elif session.intent in (ConversationIntent.BOOK_APPOINTMENT,
                                ConversationIntent.DOCTOR_INFO,
                                ConversationIntent.CHECK_QUEUE):
            # Subsequent turns: only extract fields (no intent detection needed)
            extracted = await self.groq.extract_booking_fields(session, user_text)
            self._apply_extracted_fields(session, extracted)

        # Advance stage
        if session.stage == BookingStage.GREETING:
            session.stage = BookingStage.INTENT_DETECTION
        elif session.stage == BookingStage.INTENT_DETECTION:
            session.stage = self._next_stage_for_intent(session.intent)

        # Fetch real-time context from DB — may resolve doctor_id from name lookup
        context_data = await self._fetch_context(session)

        # Re-compute booking stage AFTER context fetch (doctor_id may now be set)
        # Never override terminal states
        if (session.intent == ConversationIntent.BOOK_APPOINTMENT
                and session.stage not in (BookingStage.COMPLETED,)):
            session.stage = self._compute_booking_stage(session)

        # Generate AI response
        ai_response = await self.groq.generate_response(session, context_data, user_text)

        # Handle confirmed booking — only once (guard with appointment_id)
        if (session.stage == BookingStage.CONFIRMATION
                and not session.appointment_id
                and self._patient_confirmed(user_text, session.language)):
            appointment = await self._create_appointment(session)
            if appointment:
                session.appointment_id = appointment.get("id")
                session.stage = BookingStage.COMPLETED
                serial = appointment.get("serial_number", "N/A")
                ai_response = self._confirmation_message(session, serial, appointment)

        # Store messages
        session.messages.append(ConversationMessage(role="user", content=user_text))
        session.messages.append(ConversationMessage(role="assistant", content=ai_response))

        # Guard against runaway conversations
        if len(session.messages) > settings.max_conversation_turns * 2:
            session.messages = session.messages[-16:]

        await self._save_session(session)
        return ai_response

    # ──────────────────────────────────────────────────────────────────────────
    # Data layer — queries PostgreSQL directly (no Laravel backend required)
    # ──────────────────────────────────────────────────────────────────────────

    async def _fetch_context(self, session: ConversationSession) -> dict:
        """Fetch real-time doctor/queue/slot data directly from the database."""
        import asyncio
        from services import db_service as db

        context: dict = {}

        try:
            loop = asyncio.get_event_loop()

            if session.booking_data.doctor_id:
                doctor = await loop.run_in_executor(None, db.get_doctor, session.booking_data.doctor_id)
                if doctor:
                    context["doctor"] = doctor
                queue = await loop.run_in_executor(None, db.get_queue, session.booking_data.doctor_id)
                context["queue"] = queue

                if session.booking_data.preferred_date:
                    slots = await loop.run_in_executor(
                        None, db.get_slots,
                        session.booking_data.doctor_id, session.booking_data.preferred_date
                    )
                    context["available_slots"] = slots

            else:
                # Search doctors by name/dept from booking_data or extract from last message
                search = session.booking_data.doctor_name
                dept = session.booking_data.department
                doctors = await loop.run_in_executor(
                    None,
                    lambda: db.search_doctors(
                        hospital_id=session.hospital_id,
                        search=search,
                        department=dept,
                        limit=5,
                    )
                )
                context["doctors"] = doctors
                # Auto-resolve doctor_id if exactly one match
                if len(doctors) == 1:
                    session.booking_data.doctor_id = doctors[0]["id"]
                    session.booking_data.doctor_name = f"{doctors[0]['title']} {doctors[0]['name']}"
                    if not session.hospital_id:
                        session.hospital_id = doctors[0]["hospital_id"]

        except Exception as e:
            logger.warning("db_context_fetch_failed", error=str(e))

        return context

    async def _create_appointment(self, session: ConversationSession) -> dict | None:
        import asyncio
        from services import db_service as db

        bd = session.booking_data
        p = bd.patient
        if not all([bd.doctor_id, bd.preferred_date, p.name, p.mobile]):
            logger.warning("incomplete_booking_data", booking=bd.model_dump())
            return None

        try:
            loop = asyncio.get_event_loop()
            # Resolve hospital from doctor if missing
            hospital_id = session.hospital_id
            if not hospital_id:
                doctor = await loop.run_in_executor(None, db.get_doctor, bd.doctor_id)
                hospital_id = doctor.get("hospital_id") if doctor else 1

            result = await loop.run_in_executor(
                None,
                lambda: db.create_appointment(
                    hospital_id=hospital_id,
                    doctor_id=bd.doctor_id,
                    appt_date=bd.preferred_date,
                    patient_name=p.name,
                    patient_phone=p.mobile,
                    patient_age=p.age,
                    patient_gender=p.gender,
                    call_sid=session.call_sid,
                    appt_time=bd.preferred_time,
                )
            )
            return result
        except Exception as e:
            logger.error("appointment_creation_failed", error=str(e))
            return None

    # ──────────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────────

    def _next_stage_for_intent(self, intent: ConversationIntent) -> BookingStage:
        mapping = {
            ConversationIntent.BOOK_APPOINTMENT: BookingStage.DOCTOR_SELECTION,
            ConversationIntent.CHECK_QUEUE: BookingStage.DOCTOR_SELECTION,
            ConversationIntent.DOCTOR_INFO: BookingStage.DOCTOR_SELECTION,
            ConversationIntent.RESCHEDULE: BookingStage.PATIENT_INFO,
            ConversationIntent.CANCEL: BookingStage.PATIENT_INFO,
            ConversationIntent.GENERAL_INQUIRY: BookingStage.INTENT_DETECTION,
        }
        return mapping.get(intent, BookingStage.INTENT_DETECTION)

    def _compute_booking_stage(self, session: ConversationSession) -> BookingStage:
        bd = session.booking_data
        p = bd.patient
        if not bd.doctor_id and not bd.doctor_name:
            return BookingStage.DOCTOR_SELECTION
        if not bd.preferred_date:
            return BookingStage.DATE_SELECTION
        if not all([p.name, p.mobile, p.age, p.gender]):
            return BookingStage.PATIENT_INFO
        return BookingStage.CONFIRMATION

    def _apply_extracted_fields(self, session: ConversationSession, extracted: dict):
        bd = session.booking_data
        if extracted.get("doctor_name"):
            bd.doctor_name = extracted["doctor_name"]
        if extracted.get("department"):
            bd.department = extracted["department"]
        if extracted.get("preferred_date"):
            bd.preferred_date = self._resolve_date(extracted["preferred_date"])
        if extracted.get("preferred_time"):
            bd.preferred_time = extracted["preferred_time"]
        if extracted.get("patient_name"):
            bd.patient.name = extracted["patient_name"]
        if extracted.get("patient_mobile"):
            bd.patient.mobile = extracted["patient_mobile"]
        if extracted.get("patient_age"):
            bd.patient.age = extracted["patient_age"]
        if extracted.get("patient_gender"):
            bd.patient.gender = extracted["patient_gender"]

    def _resolve_date(self, date_str: str) -> str:
        """Resolve weekday names and invalid dates to ISO YYYY-MM-DD strings."""
        import datetime
        if not date_str:
            return date_str

        # Already a valid ISO date
        try:
            datetime.date.fromisoformat(date_str)
            return date_str
        except ValueError:
            pass

        # Map weekday names (Bengali and English) to Python weekday numbers (Mon=0)
        WEEKDAY_MAP = {
            "monday": 0, "সোমবার": 0,
            "tuesday": 1, "মঙ্গলবার": 1,
            "wednesday": 2, "বুধবার": 2,
            "thursday": 3, "বৃহস্পতিবার": 3,
            "friday": 4, "শুক্রবার": 4,
            "saturday": 5, "শনিবার": 5,
            "sunday": 6, "রবিবার": 6,
        }
        key = date_str.strip().lower()
        if key in WEEKDAY_MAP:
            today = datetime.date.today()
            target_weekday = WEEKDAY_MAP[key]
            days_ahead = (target_weekday - today.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7  # always go to NEXT occurrence
            return (today + datetime.timedelta(days=days_ahead)).isoformat()

        # Return as-is if unrecognised (LLM may have put a natural language string)
        return date_str

    def _patient_confirmed(self, text: str, language: str) -> bool:
        text_lower = text.lower().strip()
        # Split into words for whole-word matching (avoids "হ" matching inside "রহিম")
        text_words = set(text_lower.split())
        # Multi-word phrases still need substring check; single words use word-set
        confirmations = {
            "en": ["yes", "yeah", "yep", "confirm", "correct", "right", "ok", "okay", "sure", "done"],
            "bn": ["হ্যাঁ", "হা", "ঠিক আছে", "কনফার্ম", "জি", "জি হ্যাঁ", "ঠিকাছে", "হয়েছে", "বুক করুন"],
            "hi": ["हाँ", "हां", "ठीक है", "सही", "हो जाए", "बुक करें"],
            "ar": ["نعم", "موافق", "صح", "تمام"],
        }
        words = confirmations.get(language, []) + confirmations["en"]
        for w in words:
            if " " in w:  # multi-word phrase → substring check
                if w in text_lower:
                    return True
            else:  # single word → whole-word check
                if w in text_words:
                    return True
        return False

    def _confirmation_message(self, session: ConversationSession, serial: str, appointment: dict) -> str:
        name = session.booking_data.patient.name or "রোগী"
        doctor = appointment.get("doctor_name") or session.booking_data.doctor_name or "ডাক্তার"
        appt_date = session.booking_data.preferred_date or "নির্ধারিত তারিখ"
        messages = {
            "bn": (
                f"আপনার অ্যাপয়েন্টমেন্ট সফলভাবে বুক হয়েছে, {name}! "
                f"আপনার সিরিয়াল নম্বর হলো {serial}। "
                f"{appt_date} তারিখে {doctor}-এর সাথে আপনার অ্যাপয়েন্টমেন্ট রয়েছে। "
                f"ধন্যবাদ!"
            ),
            "en": (
                f"Your appointment is confirmed, {name}! "
                f"Your serial number is {serial}. "
                f"You are booked with {doctor} on {appt_date}. Thank you!"
            ),
            "hi": (
                f"आपकी अपॉइंटमेंट पक्की हो गई, {name}! "
                f"सीरियल नंबर {serial}। {appt_date} को {doctor} से मिलें। धन्यवाद!"
            ),
        }
        return messages.get(session.language, messages["bn"])
