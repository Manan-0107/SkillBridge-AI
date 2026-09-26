"""
CareerForge Conversational Dialogue Manager
===========================================
Alexa-grade conversational intent classification, slot extraction,
session state management, and automatic follow-up questioning loops.

Supported Intent Categories:
- navigation: "go to roadmap", "open practice", "go home"
- roadmap_query: "what is next on my roadmap?", "what to learn after react?"
- roadmap_action: "mark css flexbox complete", "mark done"
- form_input: "my name is Alex Rivera", "email alex@example.com"
- question: open-domain knowledge & career questions
- incomplete_needs_followup: triggers conversational clarification question
"""

import re
import time
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

# In-Memory Session Store with TTL
SESSION_STORE: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 1800  # 30 minutes


class DialogueResponse(BaseModel):
    intent: str
    action: Optional[str] = None
    target: Optional[str] = None
    reply_text: str
    requires_followup: bool = False
    expected_slot: Optional[str] = None
    session_id: str
    slots: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.95


class DialogueManager:
    def __init__(self):
        pass

    def get_session(self, session_id: str) -> Dict[str, Any]:
        now = time.time()
        if session_id in SESSION_STORE:
            session = SESSION_STORE[session_id]
            if now - session.get("updated_at", 0) < SESSION_TTL_SECONDS:
                session["updated_at"] = now
                return session

        new_session = {
            "session_id": session_id,
            "created_at": now,
            "updated_at": now,
            "pending_slot": None,
            "last_intent": None,
            "active_roadmap": "frontend",
            "slots": {},
            "history": [],
        }
        SESSION_STORE[session_id] = new_session
        return new_session

    def save_session(self, session: Dict[str, Any]):
        session["updated_at"] = time.time()
        SESSION_STORE[session["session_id"]] = session

    def process_utterance(
        self,
        session_id: str,
        text: str,
        context: Optional[Dict[str, Any]] = None,
        require_confirmation: bool = False,
    ) -> DialogueResponse:
        if context and "require_confirmation" in context:
            require_confirmation = bool(context["require_confirmation"])

        clean_text = text.strip()
        lower = clean_text.lower()
        session = self.get_session(session_id)
        pending_slot = session.get("pending_slot")

        session["history"].append({"role": "user", "text": clean_text, "timestamp": time.time()})

        # ─────────────────────────────────────────────────────────────────────
        # 1. Resolve Active Follow-Up Context (Slot-Filling & Confirmation Mode)
        # ─────────────────────────────────────────────────────────────────────
        is_yes = bool(re.search(r"^\s*(yes|yeah|yep|yup|correct|confirm|sure|ok|okay|right|looks good|save|हाँ|હા|oui|sí)\b", lower))
        is_no = bool(re.search(r"^\s*(no|nope|nah|wrong|cancel|stop|re-speak|incorrect|नहीं|ના|non)\b", lower))

        if pending_slot == "confirm_slot":
            unconfirmed = session.get("unconfirmed_slot") or {}
            action_type = unconfirmed.get("type", "form_input")
            field = unconfirmed.get("field", "value")
            val = unconfirmed.get("value", "")

            if is_yes:
                session["pending_slot"] = None
                session["unconfirmed_slot"] = None
                if action_type == "form_input":
                    session["slots"][field] = val
                    slots_out = {field: val}
                    if field in ["target_role", "targetRole"]:
                        session["slots"]["targetRole"] = val
                        session["slots"]["target_role"] = val
                        slots_out["targetRole"] = val
                        slots_out["target_role"] = val
                    self.save_session(session)
                    return DialogueResponse(
                        intent="form_input",
                        action="set_field",
                        target=field,
                        reply_text=f"Confirmed and saved your {field.replace('_', ' ')} as '{val}'.",
                        requires_followup=False,
                        session_id=session_id,
                        slots=slots_out,
                    )
                elif action_type == "roadmap_action":
                    self.save_session(session)
                    return DialogueResponse(
                        intent="roadmap_action",
                        action="mark_complete",
                        target=val,
                        reply_text=f"Confirmed! I have marked {val} as completed on your roadmap.",
                        requires_followup=False,
                        session_id=session_id,
                        slots={"node": val},
                    )
                elif action_type == "navigation":
                    self.save_session(session)
                    return DialogueResponse(
                        intent="navigation",
                        action="navigate",
                        target=val,
                        reply_text=f"Confirmed! Navigating to {val.replace('/', ' ')}.",
                        requires_followup=False,
                        session_id=session_id,
                    )

            if is_no:
                session["unconfirmed_slot"] = None
                if action_type == "form_input":
                    session["pending_slot"] = field
                    self.save_session(session)
                    field_label = field.replace('_', ' ')
                    return DialogueResponse(
                        intent="incomplete_needs_followup",
                        action="prompt_field",
                        target=field,
                        reply_text=f"No problem, let's try again. What is your {field_label}?",
                        requires_followup=True,
                        expected_slot=field,
                        session_id=session_id,
                    )
                else:
                    session["pending_slot"] = None
                    self.save_session(session)
                    return DialogueResponse(
                        intent="navigation",
                        action="cancelled",
                        target="assistant",
                        reply_text="Action cancelled. What would you like to do next?",
                        requires_followup=False,
                        session_id=session_id,
                    )

            # If user spoke an updated correction directly instead of yes/no
            updated_val = clean_text.strip(" .")
            session["unconfirmed_slot"]["value"] = updated_val
            self.save_session(session)
            return DialogueResponse(
                intent="confirmation",
                action="await_confirmation",
                target=field,
                reply_text=f"I heard: '{updated_val}'. Is that correct? Say Yes to continue, or No to re-speak.",
                requires_followup=True,
                expected_slot="confirmation",
                session_id=session_id,
                slots={"field": field, "provisional_value": updated_val},
            )

        if pending_slot:
            if pending_slot == "profile_field_choice":
                if any(w in lower for w in ["name", "full name"]):
                    session["pending_slot"] = "name"
                    self.save_session(session)
                    return DialogueResponse(
                        intent="form_input",
                        action="prompt_field",
                        target="name",
                        reply_text="What is your full name?",
                        requires_followup=True,
                        expected_slot="name",
                        session_id=session_id,
                    )
                elif any(w in lower for w in ["email", "mail"]):
                    session["pending_slot"] = "email"
                    self.save_session(session)
                    return DialogueResponse(
                        intent="form_input",
                        action="prompt_field",
                        target="email",
                        reply_text="What is your email address?",
                        requires_followup=True,
                        expected_slot="email",
                        session_id=session_id,
                    )
                elif any(w in lower for w in ["role", "job", "career", "target"]):
                    session["pending_slot"] = "target_role"
                    self.save_session(session)
                    return DialogueResponse(
                        intent="form_input",
                        action="prompt_field",
                        target="target_role",
                        reply_text="What is your target career role?",
                        requires_followup=True,
                        expected_slot="target_role",
                        session_id=session_id,
                    )

            if pending_slot == "roadmap_node_choice":
                node_title = clean_text.strip(" .")
                if require_confirmation:
                    session["unconfirmed_slot"] = {"type": "roadmap_action", "field": "node", "value": node_title}
                    session["pending_slot"] = "confirm_slot"
                    self.save_session(session)
                    return DialogueResponse(
                        intent="confirmation",
                        action="await_confirmation",
                        target="node",
                        reply_text=f"I heard: '{node_title}'. Should I mark this topic as complete on your roadmap? Say Yes to confirm, or No to re-speak.",
                        requires_followup=True,
                        expected_slot="confirmation",
                        session_id=session_id,
                        slots={"node": node_title},
                    )
                else:
                    session["pending_slot"] = None
                    self.save_session(session)
                    return DialogueResponse(
                        intent="roadmap_action",
                        action="mark_complete",
                        target=node_title,
                        reply_text=f"Great job! I have marked {node_title} as completed on your roadmap.",
                        requires_followup=False,
                        session_id=session_id,
                        slots={"node": node_title},
                    )

            if pending_slot in ["name", "email", "target_role", "targetRole", "skills"]:
                slot_val = clean_text.strip(" .")
                target_field = "targetRole" if pending_slot in ["target_role", "targetRole"] else pending_slot
                if require_confirmation:
                    session["unconfirmed_slot"] = {"type": "form_input", "field": target_field, "value": slot_val}
                    session["pending_slot"] = "confirm_slot"
                    self.save_session(session)
                    field_label = target_field.replace('_', ' ')
                    slots_out = {"provisional_field": target_field, "provisional_value": slot_val}
                    if target_field in ["target_role", "targetRole"]:
                        slots_out["targetRole"] = slot_val
                        slots_out["target_role"] = slot_val
                    return DialogueResponse(
                        intent="confirmation",
                        action="await_confirmation",
                        target=target_field,
                        reply_text=f"I heard: '{slot_val}' for your {field_label}. Is that correct? Say Yes to continue, or No to re-speak.",
                        requires_followup=True,
                        expected_slot="confirmation",
                        session_id=session_id,
                        slots=slots_out,
                    )
                else:
                    session["slots"][target_field] = slot_val
                    slots_out = {target_field: slot_val}
                    if target_field in ["target_role", "targetRole"]:
                        session["slots"]["target_role"] = slot_val
                        session["slots"]["targetRole"] = slot_val
                        slots_out["targetRole"] = slot_val
                        slots_out["target_role"] = slot_val
                    session["pending_slot"] = None
                    self.save_session(session)
                    return DialogueResponse(
                        intent="form_input",
                        action="set_field",
                        target=target_field,
                        reply_text=f"Got it! Saved your {target_field.replace('_', ' ')} as {slot_val}.",
                        requires_followup=False,
                        session_id=session_id,
                        slots=slots_out,
                    )

        # ─────────────────────────────────────────────────────────────────────
        # 2. Roadmap Voice Actions & Queries (Checked before generic navigation)
        # ─────────────────────────────────────────────────────────────────────
        if re.search(r"\b(what('s| is) next|what should i learn|next step|next topic)\b", lower):
            active_track = session.get("active_roadmap", "frontend")
            return DialogueResponse(
                intent="roadmap_query",
                action="query_next_step",
                target=active_track,
                reply_text=f"On your {active_track.title()} roadmap, your next recommended topic is Modern CSS & Layouts (Flexbox and Grid). Would you like to view its practice quiz?",
                requires_followup=True,
                expected_slot="practice_confirmation",
                session_id=session_id,
            )

        mark_match = re.search(r"\b(mark|set|finish)\s+(.+?)\s+(as\s+)?(complete|done|finished)\b", lower)
        if mark_match:
            node_name = mark_match.group(2).strip()
            if require_confirmation:
                session["unconfirmed_slot"] = {"type": "roadmap_action", "field": "node", "value": node_name}
                session["pending_slot"] = "confirm_slot"
                self.save_session(session)
                return DialogueResponse(
                    intent="confirmation",
                    action="await_confirmation",
                    target=node_name,
                    reply_text=f"I heard: 'Mark {node_name} as complete'. Is that correct? Say Yes to confirm, or No to cancel.",
                    requires_followup=True,
                    expected_slot="confirmation",
                    session_id=session_id,
                    slots={"node": node_name},
                )
            else:
                return DialogueResponse(
                    intent="roadmap_action",
                    action="mark_complete",
                    target=node_name,
                    reply_text=f"Marked {node_name} as complete on your learning path. Keep up the momentum!",
                    requires_followup=False,
                    session_id=session_id,
                    slots={"node": node_name},
                )

        # Incomplete roadmap mark without node
        if re.search(r"^\s*(mark complete|mark as done|mark done)\s*$", lower):
            session["pending_slot"] = "roadmap_node_choice"
            self.save_session(session)
            return DialogueResponse(
                intent="incomplete_needs_followup",
                action="prompt_node",
                target="roadmap",
                reply_text="Which topic would you like to mark as complete?",
                requires_followup=True,
                expected_slot="roadmap_node_choice",
                session_id=session_id,
            )

        # ─────────────────────────────────────────────────────────────────────
        # 3. Explicit Navigation Routing Table (Fast-Path)
        # ─────────────────────────────────────────────────────────────────────
        # ROADMAP
        if re.search(r"\b(go to|open|navigate to|switch to|show me|view)\s+(the\s+)?([a-zA-Z]+\s+)?roadmaps?\b", lower) or re.search(r"^\s*([a-zA-Z]+)?\s*roadmaps?\s*$", lower):
            track_match = re.search(r"\b(frontend|backend|mobile|fullstack|devops|ai|data|cloud)\b", lower)
            track = track_match.group(1) if track_match else "frontend"
            return DialogueResponse(
                intent="navigation",
                action="navigate",
                target=f"roadmap/{track}",
                reply_text=f"Opening the {track.title()} roadmap for you.",
                requires_followup=False,
                session_id=session_id,
            )

        # PRACTICE HUB
        if re.search(r"\b(go to|open|navigate to|switch to|show me|view)\s+(the\s+)?([a-zA-Z]+\s+)?(practice|quiz|practice hub|daily practice|drill)\b", lower) or re.search(r"^\s*(practice|daily practice|quiz|drill)\s*$", lower):
            return DialogueResponse(
                intent="navigation",
                action="navigate",
                target="practice",
                reply_text="Navigating to the Daily Practice Hub.",
                requires_followup=False,
                session_id=session_id,
            )

        # RESUME SUITE & ATS
        if re.search(r"\b(go to|open|navigate to|switch to|show me|view)\s+(the\s+)?([a-zA-Z]+\s+)?(resume|cv|resume analyzer|ats|resume builder|resume suite)\b", lower) or re.search(r"^\s*(resume|cv|ats)\s*$", lower):
            return DialogueResponse(
                intent="navigation",
                action="navigate",
                target="resume",
                reply_text="Opening the Resume Builder and ATS Analyzer.",
                requires_followup=False,
                session_id=session_id,
            )

        # LOCAL OPPORTUNITIES
        if re.search(r"\b(go to|open|navigate to|switch to|show me|view)\s+(the\s+)?(local|local opportunities|nearby jobs|jobs|companies|nearby)\b", lower) or re.search(r"^\s*(local|local opportunities|nearby jobs|jobs|companies|nearby)\s*$", lower):
            return DialogueResponse(
                intent="navigation",
                action="navigate",
                target="local",
                reply_text="Opening Local Opportunities and nearby jobs.",
                requires_followup=False,
                session_id=session_id,
            )

        # COURSES
        if re.search(r"\b(go to|open|navigate to|switch to|show me|view)\s+(the\s+)?(courses?|curated courses?|classes?)\b", lower) or re.search(r"^\s*(courses?)\s*$", lower):
            return DialogueResponse(
                intent="navigation",
                action="navigate",
                target="courses",
                reply_text="Opening Curated Courses.",
                requires_followup=False,
                session_id=session_id,
            )

        # ASSISTANT / HOME
        if re.search(r"\b(go home|go back|main menu|start over|assistant|home|chat|copilot)\b", lower) or re.search(r"^\s*(home|assistant|chat)\s*$", lower):
            return DialogueResponse(
                intent="navigation",
                action="navigate",
                target="assistant",
                reply_text="Returning to the CareerForge home view.",
                requires_followup=False,
                session_id=session_id,
            )

        # ─────────────────────────────────────────────────────────────────────
        # 4. Form Input & Profile Dictation with Confirmation
        # ─────────────────────────────────────────────────────────────────────
        name_match = re.search(r"(?:my name is|i am|call me)\s+([a-zA-Z\s]{2,30})", clean_text, re.IGNORECASE)
        if name_match:
            name = name_match.group(1).strip()
            if require_confirmation:
                session["unconfirmed_slot"] = {"type": "form_input", "field": "name", "value": name}
                session["pending_slot"] = "confirm_slot"
                self.save_session(session)
                return DialogueResponse(
                    intent="confirmation",
                    action="await_confirmation",
                    target="name",
                    reply_text=f"I heard: '{name}' for your name. Is that correct? Say Yes to confirm, or No to re-speak.",
                    requires_followup=True,
                    expected_slot="confirmation",
                    session_id=session_id,
                    slots={"name": name},
                )
            else:
                session["slots"]["name"] = name
                self.save_session(session)
                return DialogueResponse(
                    intent="form_input",
                    action="set_field",
                    target="name",
                    reply_text=f"Pleasure to meet you, {name}! What career path are you pursuing?",
                    requires_followup=True,
                    expected_slot="target_role",
                    session_id=session_id,
                    slots={"name": name},
                )

        email_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", clean_text)
        if email_match:
            email = email_match.group(1).strip()
            if require_confirmation:
                session["unconfirmed_slot"] = {"type": "form_input", "field": "email", "value": email}
                session["pending_slot"] = "confirm_slot"
                self.save_session(session)
                return DialogueResponse(
                    intent="confirmation",
                    action="await_confirmation",
                    target="email",
                    reply_text=f"I heard: '{email}' for your email. Is that correct? Say Yes to confirm, or No to re-speak.",
                    requires_followup=True,
                    expected_slot="confirmation",
                    session_id=session_id,
                    slots={"email": email},
                )
            else:
                session["slots"]["email"] = email
                self.save_session(session)
                return DialogueResponse(
                    intent="form_input",
                    action="set_field",
                    target="email",
                    reply_text=f"Recorded your email address as {email}.",
                    requires_followup=False,
                    session_id=session_id,
                    slots={"email": email},
                )

        role_match = re.search(r"(?:target role is|my role is|my target role is|role is|target role:?|pursuing role as)\s+([a-zA-Z0-9\s\+\#\.\-]{2,40})", clean_text, re.IGNORECASE)
        if role_match:
            role_val = role_match.group(1).strip()
            if require_confirmation:
                session["unconfirmed_slot"] = {"type": "form_input", "field": "targetRole", "value": role_val}
                session["pending_slot"] = "confirm_slot"
                self.save_session(session)
                return DialogueResponse(
                    intent="confirmation",
                    action="await_confirmation",
                    target="targetRole",
                    reply_text=f"I heard: '{role_val}' for your target role. Is that correct? Say Yes to continue, or No to re-speak.",
                    requires_followup=True,
                    expected_slot="confirmation",
                    session_id=session_id,
                    slots={"field": "targetRole", "targetRole": role_val, "target_role": role_val, "provisional_value": role_val},
                )
            else:
                session["slots"]["targetRole"] = role_val
                session["slots"]["target_role"] = role_val
                self.save_session(session)
                return DialogueResponse(
                    intent="form_input",
                    action="set_field",
                    target="targetRole",
                    reply_text=f"Got it! Saved your target role as {role_val}.",
                    requires_followup=False,
                    session_id=session_id,
                    slots={"targetRole": role_val, "target_role": role_val},
                )

        # Incomplete profile update
        if re.search(r"^\s*(update my profile|edit profile|change my details|fill profile)\s*$", lower):
            session["pending_slot"] = "profile_field_choice"
            self.save_session(session)
            return DialogueResponse(
                intent="incomplete_needs_followup",
                action="prompt_field_choice",
                target="profile",
                reply_text="Which profile field would you like to update: your name, email, or target role?",
                requires_followup=True,
                expected_slot="profile_field_choice",
                session_id=session_id,
            )

        # ─────────────────────────────────────────────────────────────────────
        # 5. General Knowledge & Career Guidance Question
        # ─────────────────────────────────────────────────────────────────────
        # If none of the command heuristics matched, treat as an intelligent question
        return DialogueResponse(
            intent="question",
            action="answer",
            target="ai_assistant",
            reply_text="",  # To be filled by AI engine
            requires_followup=False,
            session_id=session_id,
        )


dialogue_manager = DialogueManager()
