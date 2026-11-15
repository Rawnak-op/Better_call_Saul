"""Text-to-speech service for Saul Goodman voice generation.

Supports:
1. Fish Audio Saul Goodman voice model (https://fish.audio)
2. ElevenLabs custom voice cloning
3. OpenAI Neural TTS (onyx/echo fast-talking lawyer voice) as immediate fallback
"""
from __future__ import annotations

import logging
import re
from typing import Optional

import httpx
from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """Generates speech audio for Saul Goodman's legal counsel."""

    def __init__(self) -> None:
        self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        logger.info(
            "TTSService initialised — FishAudio configured: %s, ElevenLabs configured: %s, OpenAI voice: %s",
            bool(settings.FISH_AUDIO_API_KEY and settings.FISH_AUDIO_VOICE_ID),
            bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_VOICE_ID),
            settings.OPENAI_TTS_VOICE,
        )

    @staticmethod
    def clean_text_for_speech(text: str) -> str:
        """Strip markdown markers and formatting so speech sounds natural."""
        # Strip bold/italic/strikethrough/inline code markers
        cleaned = re.sub(r'[*#_`~>[\]]', '', text)
        # Strip parenthesized citations/links
        cleaned = re.sub(r'\(.*?\)', '', cleaned)
        # Strip horizontal rules
        cleaned = re.sub(r'---+', '', cleaned)
        # Replace multiple newlines with full stops for natural pauses
        cleaned = re.sub(r'\n+', '. ', cleaned)
        # Clean extra whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        # Cap length to 4000 characters to prevent excessive generation latency
        return cleaned[:4000].strip()

    async def generate_speech(self, text: str) -> bytes:
        """Convert counsel text to MP3 audio bytes."""
        clean_text = self.clean_text_for_speech(text)
        if not clean_text:
            return b""

        # 1. Fish Audio (Exact free Saul Goodman voice model from fish.audio!)
        if settings.FISH_AUDIO_API_KEY and settings.FISH_AUDIO_VOICE_ID:
            try:
                url = "https://api.fish.audio/v1/tts"
                headers = {
                    "Authorization": f"Bearer {settings.FISH_AUDIO_API_KEY}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "text": clean_text,
                    "reference_id": settings.FISH_AUDIO_VOICE_ID,
                    "format": "mp3",
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, headers=headers, json=payload, timeout=45.0)
                    if resp.status_code == 200 and resp.content:
                        logger.info(
                            "Fish Audio Saul Goodman voice generated successfully (%d bytes)",
                            len(resp.content),
                        )
                        return resp.content
                    else:
                        logger.warning(
                            "Fish Audio TTS returned HTTP %d: %s. Falling back.",
                            resp.status_code,
                            resp.text[:200],
                        )
            except Exception as exc:
                logger.error("Fish Audio TTS call failed: %s. Falling back.", exc)

        # 2. ElevenLabs Voice Clone (If configured)
        if settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_VOICE_ID:
            try:
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{settings.ELEVENLABS_VOICE_ID}"
                headers = {
                    "xi-api-key": settings.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                }
                payload = {
                    "text": clean_text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.45,
                        "similarity_boost": 0.85,
                        "style": 0.4,
                    },
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, headers=headers, json=payload, timeout=45.0)
                    if resp.status_code == 200 and resp.content:
                        logger.info(
                            "ElevenLabs Saul Goodman voice generated successfully (%d bytes)",
                            len(resp.content),
                        )
                        return resp.content
                    else:
                        logger.warning(
                            "ElevenLabs TTS returned HTTP %d: %s. Falling back to OpenAI TTS.",
                            resp.status_code,
                            resp.text[:200],
                        )
            except Exception as exc:
                logger.error("ElevenLabs TTS call failed: %s. Falling back to OpenAI TTS.", exc)

        # 3. OpenAI Neural Studio TTS Fallback (Instant, studio-grade lawyer voice)
        try:
            logger.info("Generating audio via OpenAI TTS (voice=%s)", settings.OPENAI_TTS_VOICE)
            response = await self._openai_client.audio.speech.create(
                model="tts-1",
                voice=settings.OPENAI_TTS_VOICE,
                input=clean_text,
                speed=1.05,
            )
            audio_bytes = response.content
            logger.info("OpenAI TTS audio generated successfully (%d bytes)", len(audio_bytes))
            return audio_bytes
        except Exception as exc:
            logger.error("OpenAI TTS generation failed: %s", exc)
            raise RuntimeError(f"Text-to-speech audio generation failed: {exc}") from exc
        except Exception as exc:
            logger.error("OpenAI TTS generation failed: %s", exc)
            raise RuntimeError(f"Text-to-speech audio generation failed: {exc}") from exc
