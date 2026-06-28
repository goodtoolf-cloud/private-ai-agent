"""
FILE: backend/services/cloudflare.py
Cloudflare Workers AI integration — handles all three models.
"""

import httpx
from typing import AsyncGenerator
from config import get_settings

settings = get_settings()

MODELS = {
    "deepseek": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    "llama": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "gemini": "@cf/google/gemma-7b-it-lora",   # Cloudflare's multimodal option
}

BASE_URL = f"https://api.cloudflare.com/client/v4/accounts/{settings.cloudflare_account_id}/ai/run"

ROUTING_RULES = {
    "pdf": "gemini",
    "excel": "gemini",
    "csv": "gemini",
    "word": "gemini",
    "image": "gemini",
    "audio": "gemini",
    "video": "gemini",
    "research": "deepseek",
    "analysis": "deepseek",
    "math": "deepseek",
    "science": "deepseek",
    "code": "deepseek",
    "quick": "llama",
    "simple": "llama",
    "translate": "llama",
    "summarize": "llama",
}

TASK_KEYWORDS = {
    "deepseek": [
        "research", "analyze", "analyse", "compare", "explain deeply", "step by step",
        "calculate", "solve", "equation", "math", "science", "code", "debug", "why",
        "how does", "proof", "derive", "complex",
    ],
    "gemini": [
        "image", "photo", "picture", "pdf", "excel", "spreadsheet", "word", "document",
        "audio", "video", "file", "upload", "scan", "ocr", "read this file",
    ],
    "llama": [
        "translate", "summarize", "summary", "quick", "simple", "what is", "define",
        "list", "short answer", "tldr",
    ],
}


def auto_select_model(message: str, has_file: bool = False, file_type: str = "") -> str:
    """Automatically pick the best model for the task."""
    msg_lower = message.lower()

    if has_file or file_type in ["pdf", "image", "audio", "video", "excel", "csv", "docx"]:
        return "gemini"

    for kw in TASK_KEYWORDS["deepseek"]:
        if kw in msg_lower:
            return "deepseek"

    for kw in TASK_KEYWORDS["gemini"]:
        if kw in msg_lower:
            return "gemini"

    for kw in TASK_KEYWORDS["llama"]:
        if kw in msg_lower:
            return "llama"

    # Default: llama for speed on unknown tasks
    return "llama"


def model_can_handle(model: str, message: str, has_file: bool = False) -> tuple[bool, str]:
    """Check if chosen model can handle the task."""
    if has_file and model != "gemini":
        return False, f"Files require Gemini Flash. Your chosen model ({model}) cannot process files directly. Switch to Gemini or Auto?"
    return True, ""


async def chat_complete(
    messages: list[dict],
    model_key: str = "llama",
    stream: bool = False,
    system_prompt: str = "",
) -> dict:
    """
    Send chat messages to Cloudflare Workers AI.
    Returns response dict with text and usage info.
    """
    model_id = MODELS.get(model_key, MODELS["llama"])
    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }

    payload_messages = []
    if system_prompt:
        payload_messages.append({"role": "system", "content": system_prompt})
    payload_messages.extend(messages)

    payload = {
        "messages": payload_messages,
        "stream": stream,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BASE_URL}/{model_id}",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    if not data.get("success"):
        errors = data.get("errors", [])
        raise RuntimeError(f"Cloudflare AI error: {errors}")

    result_text = data["result"]["response"]

    return {
        "text": result_text,
        "model": model_key,
        "model_id": model_id,
    }


async def chat_complete_stream(
    messages: list[dict],
    model_key: str = "llama",
    system_prompt: str = "",
) -> AsyncGenerator[str, None]:
    """Stream tokens from Cloudflare Workers AI."""
    model_id = MODELS.get(model_key, MODELS["llama"])
    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }

    payload_messages = []
    if system_prompt:
        payload_messages.append({"role": "system", "content": system_prompt})
    payload_messages.extend(messages)

    payload = {
        "messages": payload_messages,
        "stream": True,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        async with client.stream(
            "POST",
            f"{BASE_URL}/{model_id}",
            headers=headers,
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    try:
                        import json
                        data = json.loads(chunk)
                        token = data.get("response", "")
                        if token:
                            yield token
                    except Exception:
                        continue


async def embed_text(text: str) -> list[float]:
    """Generate embeddings using Cloudflare's embedding model."""
    model_id = "@cf/baai/bge-small-en-v1.5"
    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/{model_id}",
            headers=headers,
            json={"text": [text]},
        )
        response.raise_for_status()
        data = response.json()

    return data["result"]["data"][0]
