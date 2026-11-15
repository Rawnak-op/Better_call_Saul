"""Configuration settings for the Saul legal chatbot backend.

Uses pydantic-settings to load from environment variables / .env file.
"""
from __future__ import annotations

import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    """Application-wide configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- OpenAI ---
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # --- RAG tuning ---
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    MAX_RETRIEVAL_DOCS: int = 5
    SIMILARITY_THRESHOLD: float = 0.65

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # --- Storage paths ---
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "saul-legal-index"
    DOCUMENTS_DIR: str = str(BASE_DIR / "data" / "documents")

    # --- Voice / TTS ---
    FISH_AUDIO_API_KEY: str = "sk-fish-_Z2EGgD0hUae0_2NGmCY6zIBxKnFywo5MycEn9RfFog"
    FISH_AUDIO_VOICE_ID: str = "15d3dea7e1f143ed864def4fd8fd0dba"
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = ""
    OPENAI_TTS_VOICE: str = "onyx"  # punchy, authoritative criminal defense lawyer voice

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        """Accept the list as a JSON string or a native list."""
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                # Treat as a single comma-separated string
                return [origin.strip() for origin in value.split(",")]
        return value


# Singleton settings instance imported by all modules
settings = Settings()
