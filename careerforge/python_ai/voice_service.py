"""
CareerForge Python Voice Service (Unified Multi-Provider)
=========================================================
Handles multi-accent, multi-lingual speech synthesis and recognition
using UnifiedVoiceOrchestrator (ElevenLabs, Sarvam AI, Azure AI).
"""

from typing import Optional, Dict, Any
from voice_providers import voice_orchestrator, AudioPayload, TranscriptEvent


class PythonVoiceService:
    def __init__(self):
        self.orchestrator = voice_orchestrator

    def synthesize_speech(
        self,
        text: str,
        language: str = "en-US",
        voice_profile: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Synthesize speech using unified provider cascade (ElevenLabs, Sarvam AI, Azure).
        """
        payload: Optional[AudioPayload] = self.orchestrator.synthesize_speech(
            text=text,
            language=language,
            voice_profile=voice_profile,
        )
        if not payload:
            return None

        return {
            "provider": payload.provider,
            "mimeType": payload.mime_type,
            "audioBytes": payload.audio_bytes,
            "audioBase64": payload.audio_base64,
            "format": payload.format,
        }

    def transcribe_speech(
        self,
        audio_bytes: bytes,
        language: str = "en-US",
    ) -> Optional[Dict[str, Any]]:
        """
        Transcribe audio using unified STT provider cascade.
        """
        event: TranscriptEvent = self.orchestrator.transcribe_audio(
            audio_bytes=audio_bytes,
            language=language,
        )
        if not event or not event.text:
            return None

        return {
            "text": event.text,
            "isFinal": event.is_final,
            "confidence": event.confidence,
            "language": event.language,
            "provider": event.provider,
            "timestamp": event.timestamp,
        }


# Singleton
voice_service = PythonVoiceService()
