"""
CareerForge Python AI Assistant Server
======================================
FastAPI server serving the dynamic AI Assistant on port 8000.
"""

import sys
import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure python_ai directory is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from engine import ai_assistant

app = FastAPI(
    title="CareerForge Python AI Brain",
    description="Dynamic Cognitive Reasoning Service for CareerForge",
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


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CareerForge Python AI Brain",
        "python_version": sys.version,
    }


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
