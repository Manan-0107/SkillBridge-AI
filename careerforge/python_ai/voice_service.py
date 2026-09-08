"""
CareerForge Python Voice Service (Sarvam AI & ElevenLabs)
=========================================================
Handles multi-accent and multilingual voice synthesis directly from Python.
"""

import os
import requests
from typing import Optional, Dict, Any


class PythonVoiceService:
    def __init__(self):
        self.elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        self.elevenlabs_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM").strip()
        self.sarvam_key = os.getenv("SARVAM_API_KEY", "").strip()

    def synthesize_speech(
        self,
        text: str,
        language: str = "en-IN",
    ) -> Optional[Dict[str, Any]]:
        """
        Attempts synthesis via ElevenLabs or Sarvam AI, returning audio bytes metadata.
        """
        if not text:
            return None

        # 1. Try ElevenLabs Multilingual v2
        if self.elevenlabs_key and len(self.elevenlabs_key) > 5:
            try:
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.elevenlabs_voice_id}"
                headers = {
                    "xi-api-key": self.elevenlabs_key,
                    "Content-Type": "application/json",
                }
                body = {
                    "text": text[:1000],
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
                }
                resp = requests.post(url, json=body, headers=headers, timeout=6)
                if resp.status_code == 200:
                    return {
                        "provider": "ElevenLabs",
                        "mimeType": "audio/mpeg",
                        "audioBytes": resp.content,
                    }
            except Exception as e:
                print(f"[PythonVoice] ElevenLabs error: {e}")

        # 2. Try Sarvam AI (Indic / Regional Accents)
        if self.sarvam_key and len(self.sarvam_key) > 5:
            try:
                url = "https://api.sarvam.ai/text-to-speech"
                headers = {
                    "api-subscription-key": self.sarvam_key,
                    "Content-Type": "application/json",
                }
                body = {
                    "inputs": [text[:500]],
                    "target_language_code": language if "-" in language else f"{language}-IN",
                    "speaker": "meera",
                    "model": "bulbul:v1",
                }
                resp = requests.post(url, json=body, headers=headers, timeout=6)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("audios"):
                        import base64
                        return {
                            "provider": "Sarvam AI",
                            "mimeType": "audio/wav",
                            "audioBytes": base64.b64decode(data["audios"][0]),
                        }
            except Exception as e:
                print(f"[PythonVoice] Sarvam AI error: {e}")

        return None


# Singleton
voice_service = PythonVoiceService()
