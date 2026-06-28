"""
FILE: backend/services/image_gen.py
Image generation using Cloudflare Workers AI (Stable Diffusion).
"""

import httpx
import os
import uuid
from config import get_settings

settings = get_settings()

SDXL_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0"
SD_MODEL   = "@cf/runwayml/stable-diffusion-v1-5-img2img"

BASE_URL = (
    f"https://api.cloudflare.com/client/v4/accounts/"
    f"{settings.cloudflare_account_id}/ai/run"
)


async def generate_image(
    prompt: str,
    negative_prompt: str = "blurry, low quality, distorted, ugly",
    width: int = 1024,
    height: int = 1024,
    steps: int = 20,
) -> dict:
    """
    Generate an image from a text prompt via Cloudflare Workers AI.
    Returns: { "filename": str, "url": str, "prompt": str }
    """
    headers = {
        "Authorization": f"Bearer {settings.cloudflare_api_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": width,
        "height": height,
        "num_steps": steps,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BASE_URL}/{SDXL_MODEL}",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()

    # Cloudflare returns raw PNG bytes
    image_bytes = response.content
    filename = f"{uuid.uuid4()}.png"
    out_path = os.path.join(settings.generated_dir, "images", filename)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, "wb") as f:
        f.write(image_bytes)

    return {
        "filename": filename,
        "url": f"/generated/images/{filename}",
        "prompt": prompt,
        "width": width,
        "height": height,
    }
