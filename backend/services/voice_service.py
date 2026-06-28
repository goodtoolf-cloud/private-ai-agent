"""
FILE: backend/services/voice_service.py
Speech-to-text (Whisper) and text-to-speech (Piper TTS).
"""

import os
import uuid
import asyncio
from config import get_settings

settings = get_settings()


async def transcribe_audio(filepath: str) -> dict:
    """
    Transcribe audio file using faster-whisper (local, free, private).
    Supports: mp3, mp4, wav, m4a, ogg, webm
    Returns: { "text": str, "language": str, "duration": float }
    """
    try:
        from faster_whisper import WhisperModel

        # Use small model by default (fast + accurate enough)
        model = WhisperModel("small", device="cpu", compute_type="int8")

        segments, info = model.transcribe(filepath, beam_size=5)
        transcript = " ".join([seg.text for seg in segments])

        return {
            "text": transcript.strip(),
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
        }
    except ImportError:
        return {"text": "faster-whisper not installed", "language": "en", "language_probability": 0}
    except Exception as e:
        return {"text": f"Transcription error: {e}", "language": "en", "language_probability": 0}


async def synthesize_speech(text: str, output_format: str = "wav") -> dict:
    """
    Convert text to speech using Piper TTS (local, free, private).
    Returns: { "filename": str, "url": str }
    """
    filename = f"{uuid.uuid4()}.{output_format}"
    out_path = os.path.join(settings.generated_dir, "audio", filename)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    try:
        # Piper TTS — run as subprocess (piper must be installed + model downloaded)
        # Download model: wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
        model_path = os.environ.get("PIPER_MODEL", "/app/models/piper/en_US-lessac-medium.onnx")
        model_config = model_path + ".json"

        proc = await asyncio.create_subprocess_exec(
            "piper",
            "--model", model_path,
            "--config", model_config,
            "--output_file", out_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=text.encode("utf-8")),
            timeout=60.0,
        )

        if proc.returncode != 0:
            raise RuntimeError(f"Piper error: {stderr.decode()}")

        return {
            "filename": filename,
            "url": f"/generated/audio/{filename}",
        }

    except FileNotFoundError:
        # Piper not installed — fallback to gTTS (requires internet)
        return await _gtts_fallback(text, out_path, filename)
    except Exception as e:
        return {"filename": "", "url": "", "error": str(e)}


async def _gtts_fallback(text: str, out_path: str, filename: str) -> dict:
    """Fallback TTS using gTTS if Piper not available."""
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang="en")
        tts.save(out_path)
        return {"filename": filename, "url": f"/generated/audio/{filename}"}
    except Exception as e:
        return {"filename": "", "url": "", "error": f"TTS failed: {e}"}
