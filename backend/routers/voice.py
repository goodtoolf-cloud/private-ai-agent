"""
FILE: backend/routers/voice.py
Voice input (Whisper STT) and voice output (Piper TTS).
"""

import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from services.voice_service import transcribe_audio, synthesize_speech
from config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """
    Convert uploaded audio to text using Whisper (local, private).
    Supports: mp3, wav, m4a, ogg, webm, mp4
    """
    ext = audio.filename.split(".")[-1].lower() if "." in audio.filename else "wav"
    tmp_path = os.path.join(settings.upload_dir, f"voice_{uuid.uuid4()}.{ext}")
    os.makedirs(settings.upload_dir, exist_ok=True)

    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(audio.file, f)

    try:
        result = await transcribe_audio(tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return {
        "text": result["text"],
        "language": result.get("language", "en"),
        "language_probability": result.get("language_probability", 1.0),
    }


class TTSRequest(BaseModel):
    text: str
    format: str = "wav"


@router.post("/speak")
async def speak(req: TTSRequest):
    """
    Convert text to speech using Piper TTS (local, private).
    Returns a URL to the generated audio file.
    """
    result = await synthesize_speech(req.text, req.format)
    if result.get("error"):
        return {"success": False, "error": result["error"]}
    return {
        "success": True,
        "url": result["url"],
        "filename": result["filename"],
    }
