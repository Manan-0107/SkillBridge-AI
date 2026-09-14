"""
CareerForge Python AI Assistant Server
======================================
FastAPI server serving the dynamic AI Assistant and Voice Dialogue Manager on port 8000.
"""

import sys
import os
import time
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure python_ai directory is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from engine import ai_assistant
from dialogue_manager import dialogue_manager, DialogueResponse
from voice_service import voice_service

app = FastAPI(
    title="CareerForge Python AI Brain",
    description="Dynamic Cognitive Reasoning Service and Voice Dialogue Manager for CareerForge",
    version="1.0.0",
)

# Enable CORS for Next.js development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str = "user"
    text: str = ""


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    userProfile: Optional[Dict[str, Any]] = None
    targetRole: Optional[str] = None
    voiceMode: Optional[bool] = False
    currentPage: Optional[str] = "assistant"
    currentEntity: Optional[Dict[str, Any]] = None
    accessibilityPrefs: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    reply: str
    thinking: List[str] = Field(default_factory=list)
    action: Optional[Dict[str, Any]] = None
    engine: str = "CareerForge Python AI Brain"
    suggestions: List[str] = Field(default_factory=list)
    web_sources: List[Dict[str, Any]] = Field(default_factory=list)


class VoiceIntentRequest(BaseModel):
    text: str
    sessionId: Optional[str] = None
    language: Optional[str] = "en-US"
    context: Optional[Dict[str, Any]] = None


class VoiceIntentResponse(BaseModel):
    intent: str
    action: Optional[str] = None
    target: Optional[str] = None
    replyText: str
    requiresFollowup: bool = False
    expectedSlot: Optional[str] = None
    sessionId: str
    audioBase64: Optional[str] = None
    audioMimeType: Optional[str] = None
    slots: Dict[str, Any] = Field(default_factory=dict)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CareerForge Python AI Brain",
        "python_version": sys.version,
    }


@app.post("/api/voice/intent", response_model=VoiceIntentResponse)
def voice_intent_endpoint(payload: VoiceIntentRequest):
    try:
        session_id = payload.sessionId or f"sess_{int(time.time()*1000)}"
        require_conf = True
        if payload.context and "require_confirmation" in payload.context:
            require_conf = bool(payload.context["require_confirmation"])

        dialogue_res: DialogueResponse = dialogue_manager.process_utterance(
            session_id=session_id,
            text=payload.text,
            context=payload.context,
            require_confirmation=require_conf,
        )

        reply_text = dialogue_res.reply_text

        # If it's a general question needing AI engine deliberation:
        if dialogue_res.intent == "question" and not reply_text:
            chat_res = ai_assistant.process_chat(
                messages=[{"role": "user", "text": payload.text}],
                voice_mode=True,
                current_page="assistant",
            )
            reply_text = chat_res.get("reply", "I am looking into that for you.")

        # Attempt to synthesize speech audio for immediate playback
        audio_data = None
        try:
            audio_data = voice_service.synthesize_speech(
                text=reply_text,
                language=payload.language or "en-US",
            )
        except Exception as synth_err:
            print(f"[VoiceIntent] Synthesis notice: {synth_err}", file=sys.stderr)

        return VoiceIntentResponse(
            intent=dialogue_res.intent,
            action=dialogue_res.action,
            target=dialogue_res.target,
            replyText=reply_text,
            requiresFollowup=dialogue_res.requires_followup,
            expectedSlot=dialogue_res.expected_slot,
            sessionId=session_id,
            audioBase64=audio_data.get("audioBase64") if audio_data else None,
            audioMimeType=audio_data.get("mimeType") if audio_data else None,
            slots=dialogue_res.slots,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(payload: ChatRequest):
    try:
        raw_messages = [{"role": m.role, "text": m.text} for m in payload.messages]
        result = ai_assistant.process_chat(
            messages=raw_messages,
            user_profile=payload.userProfile,
            target_role=payload.targetRole,
            voice_mode=bool(payload.voiceMode),
            current_page=payload.currentPage or "assistant",
            current_entity=payload.currentEntity,
            accessibility_prefs=payload.accessibilityPrefs,
        )
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_AI_PORT", "8000"))
    print(f"Starting CareerForge Python AI Server on http://127.0.0.1:{port}...")
    uvicorn.run(app, host="127.0.0.1", port=port)
