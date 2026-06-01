import asyncio
import io
import json
import structlog
from groq import AsyncGroq, RateLimitError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_not_exception_type
from langdetect import detect

from config import get_settings
from models.conversation import ConversationSession, ConversationIntent, BookingStage

logger = structlog.get_logger()
settings = get_settings()

SYSTEM_PROMPT = """আপনি একটি হাসপাতালের AI রিসেপশনিস্ট। আপনার কাজ হলো রোগীদের ডাক্তারের অ্যাপয়েন্টমেন্ট বুক করতে, সিরিয়াল নম্বর জানতে, ডাক্তারের তথ্য জানতে এবং অ্যাপয়েন্টমেন্ট পরিবর্তন বা বাতিল করতে সাহায্য করা।

মূল নিয়মাবলী:
- সবসময় বাংলায় কথা বলুন (ডিফল্ট ভাষা বাংলা)
- রোগী যে ভাষায় কথা বলেন, সেই ভাষায় উত্তর দিন
- উষ্ণ, পেশাদার এবং সহানুভূতিশীলভাবে কথা বলুন
- ভয়েসের জন্য সংক্ষিপ্ত উত্তর দিন (সর্বোচ্চ ২-৩ বাক্য)
- সবসময় গুরুত্বপূর্ণ তথ্য রোগীকে কনফার্ম করুন
- শুধুমাত্র প্রদত্ত context data ব্যবহার করুন — নিজে থেকে ডাক্তারের তথ্য তৈরি করবেন না
- ডাক্তারের নাম, ফি, সিরিয়াল নম্বর সবকিছু বাংলায় বলুন

You are an AI receptionist. Default language is Bengali. If the patient speaks English, respond in English. If Hindi, respond in Hindi.

Current context will be provided as JSON in each message."""


INTENT_DETECTION_PROMPT = """রোগীর বার্তা থেকে তার উদ্দেশ্য সনাক্ত করুন।
JSON অবজেক্ট রিটার্ন করুন:
{
  "intent": "book_appointment" | "check_queue" | "doctor_info" | "reschedule" | "cancel" | "general_inquiry",
  "language": "bn" | "en" | "hi" | "ar",
  "confidence": 0.0-1.0
}

Note: Bengali text → language "bn", English → "en", Hindi → "hi".
Only return valid JSON, no other text."""


class GroqService:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.groq_api_key)

    async def transcribe_audio(self, audio_data: bytes, language: str = "en") -> str:
        """Convert speech to text using Groq Whisper (free tier)."""
        try:
            return await self._transcribe_audio(audio_data, language)
        except RateLimitError:
            logger.warning("groq_rate_limit_stt")
            await asyncio.sleep(20)
            try:
                return await self._transcribe_audio(audio_data, language)
            except Exception:
                return ""

    @retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=2, min=5, max=30), retry=retry_if_not_exception_type(RateLimitError))
    async def _transcribe_audio(self, audio_data: bytes, language: str = "en") -> str:
        audio_file = io.BytesIO(audio_data)
        audio_file.name = "audio.wav"
        lang_map = {"en": "en", "bn": "bn", "hi": "hi", "ar": "ar"}
        lang = lang_map.get(language, "en")
        transcription = await self.client.audio.transcriptions.create(
            file=audio_file,
            model=settings.stt_model,
            language=lang,
            response_format="text",
        )
        return transcription.strip()

    async def detect_intent(self, user_message: str) -> dict:
        """Detect patient intent from their message."""
        try:
            return await self._detect_intent(user_message)
        except (RateLimitError, Exception):
            return {"intent": "general_inquiry", "language": "bn", "confidence": 0.5}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=20), retry=retry_if_not_exception_type(RateLimitError))
    async def _detect_intent(self, user_message: str) -> dict:
        response = await self.client.chat.completions.create(
            model=settings.llm_fast_model,  # 8B model — higher RPD quota
            messages=[
                {"role": "system", "content": INTENT_DETECTION_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,
            max_tokens=100,
        )
        raw = response.choices[0].message.content.strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"intent": "general_inquiry", "language": "en", "confidence": 0.5}

    async def detect_language(self, text: str) -> str:
        """Detect language of text."""
        try:
            lang = detect(text)
            supported = {"en": "en", "bn": "bn", "hi": "hi", "ar": "ar"}
            return supported.get(lang, "en")
        except Exception:
            return "en"

    async def generate_response(
        self,
        session: ConversationSession,
        context_data: dict,
        user_message: str,
    ) -> str:
        """Generate AI receptionist response using Groq LLM."""
        try:
            return await self._generate_response(session, context_data, user_message)
        except RateLimitError:
            logger.warning("groq_rate_limit_llm — waiting 20s")
            await asyncio.sleep(20)
            try:
                return await self._generate_response(session, context_data, user_message)
            except RateLimitError:
                msgs = {
                    "bn": "দুঃখিত, এই মুহূর্তে AI সার্ভার ব্যস্ত আছে। একটু পরে আবার চেষ্টা করুন।",
                    "en": "Sorry, the AI server is busy right now. Please try again in a moment.",
                    "hi": "क्षमा करें, AI सर्वर अभी व्यस्त है। कृपया थोड़ी देर बाद पुनः प्रयास करें।",
                }
                return msgs.get(session.language, msgs["en"])

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=20), retry=retry_if_not_exception_type(RateLimitError))
    async def _generate_response(
        self,
        session: ConversationSession,
        context_data: dict,
        user_message: str,
    ) -> str:
        """Internal generate — retries on transient errors, not rate limits."""
        context_str = json.dumps(context_data, ensure_ascii=False, indent=2)

        has_doctors = bool(context_data.get("doctors") or context_data.get("doctor"))
        context_instruction = (
            "⚠️ নিচের doctors/doctor তালিকা থেকেই শুধু ডাক্তারের নাম ও তথ্য বলুন। "
            "নিজে থেকে কোনো ডাক্তারের নাম তৈরি করবেন না।"
            if has_doctors else
            "⚠️ এই মুহূর্তে কোনো ডাক্তারের তথ্য পাওয়া যায়নি। রোগীকে বিভাগের নাম বা ডাক্তারের নাম বলতে বলুন।"
        )

        system_with_context = f"""{SYSTEM_PROMPT}

{context_instruction}

Current booking state: {session.stage.value}
Current intent: {session.intent.value}
Booking data collected so far: {json.dumps(session.booking_data.model_dump(), ensure_ascii=False)}

=== REAL-TIME HOSPITAL DATA (use ONLY this) ===
{context_str}
=== END OF REAL DATA ===

Stage-specific instructions:
{self._get_stage_instructions(session.stage, session.language)}"""

        messages = [{"role": "system", "content": system_with_context}]

        # Include recent conversation history (last 8 turns for context)
        for msg in session.messages[-8:]:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": user_message})

        response = await self.client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            temperature=0.7,
            max_tokens=200,
        )

        return response.choices[0].message.content.strip()

    async def extract_booking_fields(self, session: ConversationSession, user_message: str) -> dict:
        try:
            return await self._extract_booking_fields(session, user_message)
        except RateLimitError:
            await asyncio.sleep(15)
            try:
                return await self._extract_booking_fields(session, user_message)
            except Exception:
                return {}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=5, max=20), retry=retry_if_not_exception_type(RateLimitError))
    async def _extract_booking_fields(self, session: ConversationSession, user_message: str) -> dict:
        """Extract structured booking fields from conversation."""
        import datetime
        today = datetime.date.today()
        tomorrow = (today + datetime.timedelta(days=1)).isoformat()
        day_after = (today + datetime.timedelta(days=2)).isoformat()

        system_prompt = """You are a data extraction assistant. Extract booking fields from patient messages (Bengali, English, or Hindi).
Return ONLY a raw JSON object — no markdown, no code fences, no explanation.
If a field is not mentioned, set it to null.

Date rules:
- "আগামীকাল" / "tomorrow" → use the tomorrow_date value provided
- "পরশু" / "day after tomorrow" → use the day_after_date value provided
- "আজ" / "today" → use the today_date value provided
- Any other relative phrase, resolve to YYYY-MM-DD

Time rules:
- "সকালে" / "morning" → "09:00"
- "দুপুরে" / "noon" → "12:00"
- "বিকেলে" / "afternoon" → "15:00"
- "সন্ধ্যায়" / "evening" → "18:00"
- "রাতে" / "night" → "19:00"

Gender rules:
- "ছেলে", "পুরুষ", "male", "man", "boy" → "male"
- "মেয়ে", "মহিলা", "নারী", "female", "woman", "girl" → "female"

Doctor name: extract the actual name, stripping honorifics like "স্যার", "ম্যাডাম", "ডাঃ", "Dr." from the extracted value.

Example 1:
Input: আনোয়ার হোসেন স্যারের কাছে আগামীকাল সকালে যেতে চাই
Output: {"doctor_name": "আনোয়ার হোসেন", "department": null, "preferred_date": "TOMORROW", "preferred_time": "09:00", "patient_name": null, "patient_mobile": null, "patient_age": null, "patient_gender": null}

Example 2:
Input: হৃদরোগ বিভাগে একটা অ্যাপয়েন্টমেন্ট দরকার পরশু বিকেলে
Output: {"doctor_name": null, "department": "হৃদরোগ", "preferred_date": "DAY_AFTER", "preferred_time": "15:00", "patient_name": null, "patient_mobile": null, "patient_age": null, "patient_gender": null}

Example 3:
Input: আমার নাম করিম, মোবাইল 01711223344, বয়স 45, পুরুষ
Output: {"doctor_name": null, "department": null, "preferred_date": null, "preferred_time": null, "patient_name": "করিম", "patient_mobile": "01711223344", "patient_age": 45, "patient_gender": "male"}

Example 4:
Input: Dr. Nasrin er kache jete chai, diabetes department, next Thursday
Output: {"doctor_name": "Nasrin", "department": "diabetes", "preferred_date": null, "preferred_time": null, "patient_name": null, "patient_mobile": null, "patient_age": null, "patient_gender": null}"""

        user_prompt = f"""Today: {today.isoformat()} (TOMORROW={tomorrow}, DAY_AFTER={day_after})
Current booking data: {json.dumps(session.booking_data.model_dump(), ensure_ascii=False)}
Patient message: "{user_message}"

Extract and return JSON. Replace TOMORROW with {tomorrow} and DAY_AFTER with {day_after} in the output."""

        response = await self.client.chat.completions.create(
            model=settings.llm_fast_model,  # 8B model — field extraction is simple
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
            max_tokens=250,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("extract_booking_fields_json_error", raw=raw[:200])
            return {}

    def _get_stage_instructions(self, stage: BookingStage, language: str) -> str:
        is_bn = language == "bn"
        instructions = {
            BookingStage.GREETING: (
                "রোগীকে উষ্ণভাবে স্বাগত জানান এবং জিজ্ঞেস করুন কীভাবে সাহায্য করতে পারেন।"
                if is_bn else "Greet the patient warmly and ask how you can help."
            ),
            BookingStage.INTENT_DETECTION: (
                "রোগী কী চান তা বুঝুন।"
                if is_bn else "Understand what the patient needs."
            ),
            BookingStage.DOCTOR_SELECTION: (
                "রোগীকে ডাক্তার বা বিভাগ বেছে নিতে সাহায্য করুন। "
                "context-এ doctors তালিকা থাকলে নাম, বিভাগ ও ফি সহ উল্লেখ করুন। "
                "একসাথে সর্বোচ্চ ৩ জন ডাক্তারের নাম বলুন।"
                if is_bn else
                "Help patient select a doctor/department. Mention up to 3 doctors from context with their name, department and fee."
            ),
            BookingStage.DATE_SELECTION: (
                "পছন্দের তারিখ ও সময় জিজ্ঞেস করুন। context-এ available_slots থাকলে জানান।"
                if is_bn else "Ask for preferred date and time. Mention available slots from context."
            ),
            BookingStage.PATIENT_INFO: (
                "একে একে সংগ্রহ করুন: রোগীর নাম, মোবাইল নম্বর, বয়স এবং লিঙ্গ। "
                "যা এখনো পাওয়া যায়নি শুধু সেটা জিজ্ঞেস করুন।"
                if is_bn else
                "Collect patient name, mobile, age, gender — ask only for what's still missing."
            ),
            BookingStage.CONFIRMATION: (
                "সম্পূর্ণ বুকিং বিবরণ সংক্ষেপে বলুন (ডাক্তার, তারিখ, রোগীর নাম, ফি) "
                "এবং নিশ্চিত করতে 'হ্যাঁ' বা 'না' বলতে বলুন।"
                if is_bn else
                "Summarize booking details and ask patient to confirm with yes or no."
            ),
            BookingStage.COMPLETED: (
                "সিরিয়াল নম্বরসহ অ্যাপয়েন্টমেন্ট নিশ্চিত করুন এবং শুভ কামনা জানান।"
                if is_bn else "Confirm appointment with serial number and wish the patient well."
            ),
        }
        return instructions.get(stage, "")
