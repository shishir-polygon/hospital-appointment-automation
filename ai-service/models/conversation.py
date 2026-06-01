from pydantic import BaseModel
from typing import Optional
from enum import Enum


class ConversationIntent(str, Enum):
    BOOK_APPOINTMENT = "book_appointment"
    CHECK_QUEUE = "check_queue"
    DOCTOR_INFO = "doctor_info"
    RESCHEDULE = "reschedule"
    CANCEL = "cancel"
    GENERAL_INQUIRY = "general_inquiry"
    UNKNOWN = "unknown"


class BookingStage(str, Enum):
    GREETING = "greeting"
    INTENT_DETECTION = "intent_detection"
    DOCTOR_SELECTION = "doctor_selection"
    DATE_SELECTION = "date_selection"
    PATIENT_INFO = "patient_info"
    CONFIRMATION = "confirmation"
    COMPLETED = "completed"


class PatientInfo(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    national_id: Optional[str] = None
    patient_id: Optional[str] = None


class BookingData(BaseModel):
    hospital_id: Optional[int] = None
    doctor_id: Optional[int] = None
    doctor_name: Optional[str] = None
    department: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    patient: PatientInfo = PatientInfo()


class ConversationMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ConversationSession(BaseModel):
    session_id: str
    call_sid: str
    hospital_id: Optional[int] = None
    caller_number: str
    language: str = "en"
    intent: ConversationIntent = ConversationIntent.UNKNOWN
    stage: BookingStage = BookingStage.GREETING
    messages: list[ConversationMessage] = []
    booking_data: BookingData = BookingData()
    appointment_id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
