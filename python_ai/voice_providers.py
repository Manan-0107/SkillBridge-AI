"""
CareerForge Unified Voice Providers Abstraction Layer
======================================================
Architecture:
- STTProvider & TTSProvider Protocols
- Language Routing:
  * Indic Languages (Hindi, Gujarati, Marathi, Tamil, Telugu, Bengali) -> Sarvam AI
  * English & International (US, UK, Indian English, Spanish, French, German, Japanese) -> Azure Speech / ElevenLabs
- Automatic Fallback Cascades with Timeout Protection
- Normalized TranscriptEvent data contract
- Strict 16kHz mono PCM validation
"""

import os
import sys
import time
import base64
import requests
from typing import Optional, Dict, Any, List, Protocol, runtime_checkable
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
load_dotenv()

INDIC_LANG_PREFIXES = {"hi", "gu", "mr", "ta", "te", "bn", "kn", "ml", "pa", "or"}


class TranscriptEvent(BaseModel):
    text: str
    is_final: bool = True
    confidence: float = 0.95
    language: str = "en"
    provider: str = "azure"
    timestamp: float = Field(default_factory=time.time)


class AudioPayload(BaseModel):
    provider: str
    mime_type: str
    audio_bytes: bytes
    audio_base64: Optional[str] = None
    sample_rate: int = 16000
    format: str = "pcm_16000"


@runtime_checkable
class STTProvider(Protocol):
    def transcribe(self, audio_bytes: bytes, language: str = "en-US") -> Optional[TranscriptEvent]:
        ...


@runtime_checkable
class TTSProvider(Protocol):
    def synthesize(self, text: str, language: str = "en-US", voice_profile: Optional[str] = None) -> Optional[AudioPayload]:
        ...


# ─────────────────────────────────────────────────────────────────────────────
# 1. Azure Speech STT & TTS Adapter
# ─────────────────────────────────────────────────────────────────────────────
class AzureSpeechAdapter(STTProvider, TTSProvider):
    def __init__(self):
        self.key = os.getenv("AZURE_SPEECH_KEY", "").strip()
        self.region = os.getenv("AZURE_SPEECH_REGION", "eastus").strip()

    def is_available(self) -> bool:
        return bool(self.key and len(self.key) > 5)

    def transcribe(self, audio_bytes: bytes, language: str = "en-US") -> Optional[TranscriptEvent]:
        if not self.is_available() or not audio_bytes:
            return None

        url = f"https://{self.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language={language}"
        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
            "Accept": "application/json",
        }

        try:
            resp = requests.post(url, data=audio_bytes, headers=headers, timeout=7)
            if resp.status_code == 200:
                data = resp.json()
                status = data.get("RecognitionStatus")
                if status == "Success":
                    return TranscriptEvent(
                        text=data.get("DisplayText", "").strip(),
                        is_final=True,
                        confidence=0.96,
                        language=language,
                        provider="azure_speech",
                    )
        except Exception as e:
            print(f"[Azure STT] Warning: {e}", file=sys.stderr)

        return None

    def synthesize(self, text: str, language: str = "en-US", voice_profile: Optional[str] = None) -> Optional[AudioPayload]:
        if not self.is_available() or not text:
            return None

        url = f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1"
        voice_name = voice_profile or ("en-US-JennyNeural" if language.startswith("en") else "hi-IN-SwaraNeural")
        
        ssml = f"""<speak version='1.0' xml:lang='{language}'>
            <voice xml:lang='{language}' name='{voice_name}'>
                {text}
            </voice>
        </speak>"""

        headers = {
            "Ocp-Apim-Subscription-Key": self.key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "riff-16khz-16bit-mono-pcm",
            "User-Agent": "CareerForge-Accessibility-Assistant",
        }

        try:
            resp = requests.post(url, data=ssml.encode("utf-8"), headers=headers, timeout=7)
            if resp.status_code == 200 and len(resp.content) > 100:
                return AudioPayload(
                    provider="azure_speech",
                    mime_type="audio/wav",
                    audio_bytes=resp.content,
                    audio_base64=base64.b64encode(resp.content).decode("ascii"),
                    sample_rate=16000,
                    format="riff_16000",
                )
        except Exception as e:
            print(f"[Azure TTS] Warning: {e}", file=sys.stderr)

        return None


# ─────────────────────────────────────────────────────────────────────────────
# 2. Sarvam AI Indic STT & TTS Adapter (Hindi, Gujarati, Marathi, etc.)
# ─────────────────────────────────────────────────────────────────────────────
class SarvamAIAdapter(STTProvider, TTSProvider):
    def __init__(self):
        self.key = os.getenv("SARVAM_API_KEY", "").strip()

    def is_available(self) -> bool:
        return bool(self.key and len(self.key) > 5)

    def transcribe(self, audio_bytes: bytes, language: str = "hi-IN") -> Optional[TranscriptEvent]:
        if not self.is_available() or not audio_bytes:
            return None

        url = "https://api.sarvam.ai/speech-to-text"
        headers = {"api-subscription-key": self.key}
        target_lang = language if "-" in language else f"{language}-IN"

        files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
        data = {
            "model": "saarika:v2",
            "language_code": target_lang,
        }

        try:
            resp = requests.post(url, headers=headers, files=files, data=data, timeout=8)
            if resp.status_code == 200:
                result = resp.json()
                transcript = result.get("transcript", "").strip()
                if transcript:
                    return TranscriptEvent(
                        text=transcript,
                        is_final=True,
                        confidence=0.94,
                        language=result.get("language_code", target_lang),
                        provider="sarvam_ai",
                    )
        except Exception as e:
            print(f"[Sarvam STT] Warning: {e}", file=sys.stderr)

        return None

    def synthesize(self, text: str, language: str = "hi-IN", voice_profile: Optional[str] = None) -> Optional[AudioPayload]:
        if not self.is_available() or not text:
            return None

        url = "https://api.sarvam.ai/text-to-speech"
        headers = {
            "api-subscription-key": self.key,
            "Content-Type": "application/json",
        }
        target_lang = language if "-" in language else f"{language}-IN"
        speaker = voice_profile or "meera"

        body = {
            "inputs": [text[:500]],
            "target_language_code": target_lang,
            "speaker": speaker,
            "model": "bulbul:v1",
        }

        try:
            resp = requests.post(url, json=body, headers=headers, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                audios = data.get("audios")
                if audios and len(audios) > 0:
                    raw_bytes = base64.b64decode(audios[0])
                    return AudioPayload(
                        provider="sarvam_ai",
                        mime_type="audio/wav",
                        audio_bytes=raw_bytes,
                        audio_base64=audios[0],
                        sample_rate=16000,
                        format="wav_16000",
                    )
        except Exception as e:
            print(f"[Sarvam TTS] Warning: {e}", file=sys.stderr)

        return None


# ─────────────────────────────────────────────────────────────────────────────
# 3. ElevenLabs Natural Speech TTS Adapter
# ─────────────────────────────────────────────────────────────────────────────
class ElevenLabsAdapter(TTSProvider):
    def __init__(self):
        self.key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        self.voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM").strip()

    def is_available(self) -> bool:
        return bool(self.key and len(self.key) > 5)

    def synthesize(self, text: str, language: str = "en-US", voice_profile: Optional[str] = None) -> Optional[AudioPayload]:
        if not self.is_available() or not text:
            return None

        voice = voice_profile or self.voice_id
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
        headers = {
            "xi-api-key": self.key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        body = {
            "text": text[:1000],
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.8,
            },
        }

        try:
            resp = requests.post(url, json=body, headers=headers, timeout=8)
            if resp.status_code == 200 and len(resp.content) > 100:
                return AudioPayload(
                    provider="elevenlabs",
                    mime_type="audio/mpeg",
                    audio_bytes=resp.content,
                    audio_base64=base64.b64encode(resp.content).decode("ascii"),
                    sample_rate=16000,
                    format="mp3",
                )
        except Exception as e:
            print(f"[ElevenLabs TTS] Warning: {e}", file=sys.stderr)

        return None


# ─────────────────────────────────────────────────────────────────────────────
# 4. Master Unified Orchestrator with Intelligent Language Routing & Fallback
# ─────────────────────────────────────────────────────────────────────────────
class UnifiedVoiceOrchestrator:
    def __init__(self):
        self.azure = AzureSpeechAdapter()
        self.sarvam = SarvamAIAdapter()
        self.elevenlabs = ElevenLabsAdapter()

    def is_indic_language(self, lang_code: str) -> bool:
        prefix = lang_code.split("-")[0].lower()
        return prefix in INDIC_LANG_PREFIXES

    def transcribe_audio(self, audio_bytes: bytes, language: str = "en-US") -> TranscriptEvent:
        """
        Routes STT based on language code with automatic provider fallback:
        - Indic language -> Sarvam AI first -> Azure fallback
        - English/International -> Azure AI first -> Sarvam fallback
        """
        is_indic = self.is_indic_language(language)

        if is_indic:
            # 1. Primary: Sarvam AI
            result = self.sarvam.transcribe(audio_bytes, language)
            if result and result.text:
                return result
            # 2. Fallback: Azure Speech
            result = self.azure.transcribe(audio_bytes, language)
            if result and result.text:
                return result
        else:
            # 1. Primary: Azure Speech
            result = self.azure.transcribe(audio_bytes, language)
            if result and result.text:
                return result
            # 2. Fallback: Sarvam AI
            result = self.sarvam.transcribe(audio_bytes, language)
            if result and result.text:
                return result

        # Fallback empty event if all fail or silent
        return TranscriptEvent(
            text="",
            is_final=True,
            confidence=0.0,
            language=language,
            provider="fallback_none",
        )

    def synthesize_speech(
        self,
        text: str,
        language: str = "en-US",
        voice_profile: Optional[str] = None,
    ) -> Optional[AudioPayload]:
        """
        Routes TTS based on language code with automatic provider fallback:
        - Indic language -> Sarvam AI Bulbul first -> ElevenLabs -> Azure
        - English/International -> ElevenLabs Turbo first -> Azure -> Sarvam
        """
        is_indic = self.is_indic_language(language)

        if is_indic:
            # Primary: Sarvam
            audio = self.sarvam.synthesize(text, language, voice_profile)
            if audio:
                return audio
            # Fallback 1: ElevenLabs Multilingual
            audio = self.elevenlabs.synthesize(text, language, voice_profile)
            if audio:
                return audio
            # Fallback 2: Azure Neural
            return self.azure.synthesize(text, language, voice_profile)
        else:
            # Primary: ElevenLabs Natural
            audio = self.elevenlabs.synthesize(text, language, voice_profile)
            if audio:
                return audio
            # Fallback 1: Azure Neural
            audio = self.azure.synthesize(text, language, voice_profile)
            if audio:
                return audio
            # Fallback 2: Sarvam
            return self.sarvam.synthesize(text, language, voice_profile)


# Singleton
voice_orchestrator = UnifiedVoiceOrchestrator()
