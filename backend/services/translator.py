"""
FILE: backend/services/translator.py
Translation using LibreTranslate (self-hosted, free) with deep-translator fallback.
"""

import httpx
from langdetect import detect
from config import get_settings

settings = get_settings()

LIBRETRANSLATE_LANGUAGES = {
    "en": "English", "ar": "Arabic", "zh": "Chinese", "fr": "French",
    "de": "German", "hi": "Hindi", "it": "Italian", "ja": "Japanese",
    "ko": "Korean", "pt": "Portuguese", "ru": "Russian", "es": "Spanish",
    "tr": "Turkish", "uk": "Ukrainian", "vi": "Vietnamese",
}


async def detect_language(text: str) -> str:
    """Detect the language of text."""
    try:
        return detect(text)
    except Exception:
        return "en"


async def translate(text: str, target_lang: str, source_lang: str = "auto") -> dict:
    """
    Translate text to target language.
    Tries LibreTranslate first, falls back to deep-translator.
    """
    if source_lang == "auto":
        source_lang = await detect_language(text)

    # Try self-hosted LibreTranslate
    result = await _libretranslate(text, source_lang, target_lang)
    if result.get("success"):
        return result

    # Fallback: deep-translator (uses Google under the hood)
    return await _deep_translator_fallback(text, source_lang, target_lang)


async def _libretranslate(text: str, source: str, target: str) -> dict:
    try:
        payload = {
            "q": text,
            "source": source,
            "target": target,
            "format": "text",
        }
        if settings.libretranslate_api_key:
            payload["api_key"] = settings.libretranslate_api_key

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.libretranslate_url}/translate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        return {
            "success": True,
            "translated_text": data["translatedText"],
            "source_language": source,
            "target_language": target,
            "engine": "LibreTranslate",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _deep_translator_fallback(text: str, source: str, target: str) -> dict:
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source=source, target=target)
        translated = translator.translate(text)
        return {
            "success": True,
            "translated_text": translated,
            "source_language": source,
            "target_language": target,
            "engine": "GoogleTranslator (fallback)",
        }
    except Exception as e:
        return {
            "success": False,
            "translated_text": "",
            "error": str(e),
            "engine": "failed",
        }


def list_languages() -> list[dict]:
    return [{"code": k, "name": v} for k, v in LIBRETRANSLATE_LANGUAGES.items()]
