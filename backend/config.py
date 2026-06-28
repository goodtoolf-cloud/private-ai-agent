"""
FILE: backend/config.py
All configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Cloudflare Workers AI
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://ai_user:ai_pass@localhost:5432/ai_agent"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8001

    # SearXNG
    searxng_url: str = "http://localhost:8080"

    # E2B Code Interpreter
    e2b_api_key: str = ""

    # Security
    secret_key: str = "changeme_long_random_string"
    algorithm: str = "HS256"

    # Paths
    upload_dir: str = "uploads"
    generated_dir: str = "generated"

    # LibreTranslate (optional self-hosted)
    libretranslate_url: str = "https://libretranslate.com"
    libretranslate_api_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
