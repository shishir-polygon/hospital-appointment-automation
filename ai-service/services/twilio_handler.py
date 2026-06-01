"""
Twilio webhook handlers — generates TwiML responses for voice calls.
Twilio calls these endpoints when a patient calls the hospital number.
"""
from xml.etree.ElementTree import Element, SubElement, tostring
import structlog

from config import get_settings

logger = structlog.get_logger()
settings = get_settings()


def build_twiml_gather(
    ai_response_url: str,
    speech_timeout: int = 3,
    language: str = "en-US",
) -> str:
    """Build TwiML that plays a message and gathers speech input."""
    language_map = {
        "en": "en-US",
        "bn": "bn-BD",
        "hi": "hi-IN",
        "ar": "ar-SA",
    }
    twiml_lang = language_map.get(language, "en-US")

    response = Element("Response")
    gather = SubElement(response, "Gather", {
        "input": "speech",
        "action": ai_response_url,
        "method": "POST",
        "speechTimeout": str(speech_timeout),
        "language": twiml_lang,
        "enhanced": "true",
    })
    return tostring(response, encoding="unicode", xml_declaration=False)


def build_twiml_play_and_gather(
    audio_url: str,
    gather_action_url: str,
    speech_timeout: int = 3,
    language: str = "en",
) -> str:
    """Play an audio file then gather speech."""
    language_map = {"en": "en-US", "bn": "bn-BD", "hi": "hi-IN", "ar": "ar-SA"}
    twiml_lang = language_map.get(language, "en-US")

    response = Element("Response")
    gather = SubElement(response, "Gather", {
        "input": "speech",
        "action": gather_action_url,
        "method": "POST",
        "speechTimeout": str(speech_timeout),
        "language": twiml_lang,
        "enhanced": "true",
    })
    play = SubElement(gather, "Play")
    play.text = audio_url

    # Fallback if caller doesn't respond
    redirect = SubElement(response, "Redirect", {"method": "POST"})
    redirect.text = gather_action_url

    return tostring(response, encoding="unicode", xml_declaration=False)


def build_twiml_say_and_gather(
    text: str,
    gather_action_url: str,
    speech_timeout: int = 3,
    language: str = "en",
) -> str:
    """Use Twilio's <Say> (fallback when TTS audio file isn't ready)."""
    language_map = {"en": "en-US", "bn": "bn-BD", "hi": "hi-IN", "ar": "ar-SA"}
    voice_map = {"en": "Polly.Joanna", "hi": "Polly.Aditi", "ar": "Polly.Zeina"}
    twiml_lang = language_map.get(language, "en-US")
    voice = voice_map.get(language, "Polly.Joanna")

    response = Element("Response")
    gather = SubElement(response, "Gather", {
        "input": "speech",
        "action": gather_action_url,
        "method": "POST",
        "speechTimeout": str(speech_timeout),
        "language": twiml_lang,
    })
    say = SubElement(gather, "Say", {"voice": voice, "language": twiml_lang})
    say.text = text

    redirect = SubElement(response, "Redirect", {"method": "POST"})
    redirect.text = gather_action_url

    return tostring(response, encoding="unicode", xml_declaration=False)


def build_twiml_hangup(farewell_text: str = "Thank you. Goodbye!", language: str = "en") -> str:
    """End the call with a farewell message."""
    language_map = {"en": "en-US", "bn": "bn-BD", "hi": "hi-IN", "ar": "ar-SA"}
    twiml_lang = language_map.get(language, "en-US")

    response = Element("Response")
    say = SubElement(response, "Say", {"language": twiml_lang})
    say.text = farewell_text
    SubElement(response, "Hangup")
    return tostring(response, encoding="unicode", xml_declaration=False)


def build_twiml_error() -> str:
    response = Element("Response")
    say = SubElement(response, "Say")
    say.text = "We're sorry, an error occurred. Please call back or contact the hospital directly."
    SubElement(response, "Hangup")
    return tostring(response, encoding="unicode", xml_declaration=False)
