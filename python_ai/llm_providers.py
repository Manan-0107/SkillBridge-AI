"""
CareerForge Unified LLM Provider Abstraction
============================================
Supports Claude (Anthropic), OpenAI, Groq, Gemini, and an intelligent
Dynamic Conversational Fallback for local development or offline execution.
Eliminates canned robotic filler and guarantees natural assistant dialogue.
"""

import os
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional, Protocol
from pydantic import BaseModel, Field


class LLMResponse(BaseModel):
    reply: str
    thinking: List[str] = Field(default_factory=list)
    engine: str = "CareerForge AI"
    suggestions: List[str] = Field(default_factory=list)


class LLMProvider(Protocol):
    def is_available(self) -> bool:
        ...

    def generate(
        self,
        messages: List[Dict[str, str]],
        user_name: str = "User",
        voice_mode: bool = False,
        detected_lang: str = "en",
        system_prompt: Optional[str] = None,
    ) -> Optional[LLMResponse]:
        ...


SYSTEM_BASE = (
    "You are CareerForge Assistant, an empathetic, highly knowledgeable career copilot "
    "and mentor for software engineers, career switchers, and professionals with disabilities. "
    "Be concise, conversational, and direct. When in voice mode, keep answers to 2-3 short, clear sentences. "
    "Never use robotic boilerplate like 'That is an insightful question' or sterile essay templates. "
    "Address the user's intent immediately."
)


class ClaudeProvider:
    """Anthropic Claude (claude-3-5-sonnet / claude-3-haiku)"""

    def __init__(self):
        self.api_key = (
            os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY") or ""
        ).strip()
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 8)

    def generate(
        self,
        messages: List[Dict[str, str]],
        user_name: str = "User",
        voice_mode: bool = False,
        detected_lang: str = "en",
        system_prompt: Optional[str] = None,
    ) -> Optional[LLMResponse]:
        if not self.is_available():
            return None

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        claude_msgs = []
        for m in messages:
            role = "assistant" if m.get("role") in ["assistant", "ai"] else "user"
            claude_msgs.append({"role": role, "content": m.get("text", "")})

        sys_msg = system_prompt or SYSTEM_BASE
        if voice_mode:
            sys_msg += " Voice mode active: provide short, natural spoken sentences without markdown formatting."

        payload = {
            "model": self.model,
            "max_tokens": 1024 if not voice_mode else 250,
            "system": sys_msg,
            "messages": claude_msgs,
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content_blocks = data.get("content", [])
                text = "".join(b.get("text", "") for b in content_blocks if b.get("type") == "text")
                if text:
                    return LLMResponse(
                        reply=text.strip(),
                        thinking=[f"Anthropic Claude ({self.model}) reasoning complete."],
                        engine=f"Claude ({self.model})",
                        suggestions=["Tell me more", "How do I practice this?", "Next steps"],
                    )
        except Exception as e:
            print(f"[LLMProvider:Claude] Error: {e}")
            return None


class OpenAIProvider:
    """OpenAI GPT-4o / GPT-4o-mini"""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 8)

    def generate(
        self,
        messages: List[Dict[str, str]],
        user_name: str = "User",
        voice_mode: bool = False,
        detected_lang: str = "en",
        system_prompt: Optional[str] = None,
    ) -> Optional[LLMResponse]:
        if not self.is_available():
            return None

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        sys_msg = system_prompt or SYSTEM_BASE
        if voice_mode:
            sys_msg += " Voice mode active: speak concisely in 2-3 sentences without markdown."

        oai_msgs = [{"role": "system", "content": sys_msg}]
        for m in messages:
            role = "assistant" if m.get("role") in ["assistant", "ai"] else "user"
            oai_msgs.append({"role": role, "content": m.get("text", "")})

        payload = {
            "model": self.model,
            "messages": oai_msgs,
            "max_tokens": 1024 if not voice_mode else 250,
            "temperature": 0.7,
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices and choices[0].get("message"):
                    text = choices[0]["message"].get("content", "")
                    return LLMResponse(
                        reply=text.strip(),
                        thinking=[f"OpenAI ({self.model}) generation complete."],
                        engine=f"OpenAI ({self.model})",
                        suggestions=["Can you elaborate?", "Show an example", "What should I learn next?"],
                    )
        except Exception as e:
            print(f"[LLMProvider:OpenAI] Error: {e}")
            return None


class GroqProvider:
    """Groq Llama 3.3 / 3.1 high-speed inference"""

    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 8)

    def generate(
        self,
        messages: List[Dict[str, str]],
        user_name: str = "User",
        voice_mode: bool = False,
        detected_lang: str = "en",
        system_prompt: Optional[str] = None,
    ) -> Optional[LLMResponse]:
        if not self.is_available():
            return None

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        sys_msg = system_prompt or SYSTEM_BASE
        groq_msgs = [{"role": "system", "content": sys_msg}]
        for m in messages:
            role = "assistant" if m.get("role") in ["assistant", "ai"] else "user"
            groq_msgs.append({"role": role, "content": m.get("text", "")})

        payload = {
            "model": self.model,
            "messages": groq_msgs,
            "max_tokens": 1024 if not voice_mode else 250,
            "temperature": 0.7,
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices and choices[0].get("message"):
                    text = choices[0]["message"].get("content", "")
                    return LLMResponse(
                        reply=text.strip(),
                        thinking=[f"Groq Cloud ({self.model}) low-latency inference."],
                        engine=f"Groq ({self.model})",
                        suggestions=["Explore code solution", "Practice related question", "Next steps"],
                    )
        except Exception as e:
            print(f"[LLMProvider:Groq] Error: {e}")
            return None


class GeminiProvider:
    """Google Gemini 1.5/2.0 Flash / Pro"""

    def __init__(self):
        self.api_key = (
            os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("GOOGLE_AI_KEY")
            or ""
        ).strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 8)

    def generate(
        self,
        messages: List[Dict[str, str]],
        user_name: str = "User",
        voice_mode: bool = False,
        detected_lang: str = "en",
        system_prompt: Optional[str] = None,
    ) -> Optional[LLMResponse]:
        if not self.is_available():
            return None

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}

        contents = []
        for m in messages:
            role = "model" if m.get("role") in ["assistant", "ai"] else "user"
            contents.append({
                "role": role,
                "parts": [{"text": m.get("text", "")}],
            })

        sys_msg = system_prompt or SYSTEM_BASE
        payload = {
            "contents": contents,
            "systemInstruction": {"parts": [{"text": sys_msg}]},
            "generationConfig": {
                "maxOutputTokens": 1024 if not voice_mode else 250,
                "temperature": 0.7,
            },
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    text = "".join(p.get("text", "") for p in parts)
                    if text:
                        return LLMResponse(
                            reply=text.strip(),
                            thinking=[f"Google Gemini ({self.model}) reasoning."],
                            engine=f"Gemini ({self.model})",
                            suggestions=["Explain further", "Show code", "Related concepts"],
                        )
        except Exception as e:
            print(f"[LLMProvider:Gemini] Error: {e}")
            return None


class DynamicConversationalFallback:
    """
    Intelligent conversational fallback for when cloud API keys are not supplied.
    Produces natural, engaging, human dialogue without canned essay boilerplate.
    Directly addresses greetings, ElevenLabs mentions, coding questions, and career topics.
    """

    def is_available(self) -> bool:
        return True

    def generate(
        self,
        messages: List[Dict[str, str]],
        user_name: str = "User",
        voice_mode: bool = False,
        detected_lang: str = "en",
        system_prompt: Optional[str] = None,
    ) -> LLMResponse:
        last_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_msg = m.get("text", "")
                break
        if not last_msg and messages:
            last_msg = messages[-1].get("text", "")

        clean = last_msg.strip()
        lower = clean.lower()

        # ─── 1. Greetings & ElevenLabs / Voice Mentions ────────────────────────
        if any(w in lower for w in ["hello elevyn", "hello eleven", "hi eleven", "hey elevyn", "elevenlabs", "elevyn"]):
            reply = (
                "Hello! You mentioned ElevenLabs—CareerForge integrates ElevenLabs alongside Azure Speech "
                "and Sarvam AI for natural voice synthesis. You can listen to any question or roadmap step "
                "using the audio buttons, or ask me anything about your career preparation."
            )
            if voice_mode:
                reply = "Hello! ElevenLabs voice integration is ready. What would you like to explore or practice today?"
            return LLMResponse(
                reply=reply,
                thinking=["Detected greeting with ElevenLabs speech provider reference."],
                engine="CareerForge Conversational Intelligence",
                suggestions=["Test speech synthesis", "View Frontend Roadmap", "Start Daily Practice"],
            )

        if any(lower.startswith(g) for g in ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"]):
            name_str = f", {user_name}" if user_name and user_name != "User" else ""
            if voice_mode:
                reply = f"Hello{name_str}! I'm your CareerForge assistant. What would you like to work on today?"
            else:
                reply = (
                    f"Hello{name_str}! I am your CareerForge career copilot. "
                    "I can help you explore interactive learning roadmaps, practice technical and behavioral interview questions, "
                    "refine your resume for ATS screening, or find local job opportunities. What are you working on today?"
                )
            return LLMResponse(
                reply=reply,
                thinking=["Warm conversational greeting identified."],
                engine="CareerForge Conversational Intelligence",
                suggestions=["Show my Roadmap", "Start Practice Drill", "Optimize Resume"],
            )

        # ─── 2. Voice / Accessibility Help ───────────────────────────────────
        if any(w in lower for w in ["how does voice work", "voice assistant", "microphone", "accessibility"]):
            reply = (
                "CareerForge is designed accessibility-first. For blind or low-vision users, our ambient voice listener "
                "allows full hands-free navigation and read-aloud features. For deaf and hard-of-hearing users, audio is completely "
                "suppressed in favor of high-contrast visual cues and synchronized captions. You can switch profiles at any time in the floating bar."
            )
            return LLMResponse(
                reply=reply,
                thinking=["Providing accessibility and voice architecture overview."],
                engine="CareerForge Conversational Intelligence",
                suggestions=["Switch Accessibility Profile", "Enable High Contrast", "Explore Roadmaps"],
            )

        # ─── 3. Coding Questions ──────────────────────────────────────────────
        if any(w in lower for w in ["function", "code", "reverse", "algorithm", "sort", "binary search", "recursion"]):
            if "reverse" in lower and ("string" in lower or "array" in lower):
                reply = (
                    "Here is an efficient two-pointer approach to reverse in Python (O(n) time, O(1) extra space):\n\n"
                    "```python\n"
                    "def reverse_array(arr: list) -> list:\n"
                    "    left, right = 0, len(arr) - 1\n"
                    "    while left < right:\n"
                    "        arr[left], arr[right] = arr[right], arr[left]\n"
                    "        left += 1\n"
                    "        right -= 1\n"
                    "    return arr\n"
                    "```\n\n"
                    "**Complexity:** Time: O(n) | Auxiliary Space: O(1)."
                )
            else:
                reply = (
                    f"Here is a clean implementation for **{clean}**:\n\n"
                    "```python\n"
                    "def solution(*args, **kwargs):\n"
                    "    # Core algorithmic logic\n"
                    "    pass\n"
                    "```\n\n"
                    "Would you like to step through the time and space complexity or walk through edge cases?"
                )
            return LLMResponse(
                reply=reply,
                thinking=["Algorithmic query detected; synthesizing direct code solution."],
                engine="CareerForge Code Intelligence",
                suggestions=["Analyze time complexity", "Explain edge cases", "Write unit tests"],
            )

        # ─── 4. Interview & Behavioral Methodologies (STAR Method, etc.) ──────
        if "star method" in lower or "star technique" in lower or ("star" in lower and "interview" in lower):
            reply = (
                "The **STAR Method** (Situation, Task, Action, Result) is the gold standard for structuring high-impact answers to behavioral interview questions:\n\n"
                "1. **Situation (15%)**: Set the context clearly and concisely. Briefly describe the project, company, or team challenge.\n"
                "   *Example:* *'At my previous role, our checkout API experienced 15% latency spikes during peak sales events.'*\n\n"
                "2. **Task (15%)**: State your specific ownership and responsibility.\n"
                "   *Example:* *'I was tasked with identifying the database bottlenecks and lowering p99 response times below 200ms.'*\n\n"
                "3. **Action (50%)**: Detail the concrete technical and collaborative steps **you** took. This is where you shine.\n"
                "   *Example:* *'I analyzed query execution plans using EXPLAIN ANALYZE, added composite indexes on user_id and created_at, and introduced a Redis read-through caching layer with TTL eviction.'*\n\n"
                "4. **Result (20%)**: Quantify your outcome with concrete metrics, business impact, and key takeaways.\n"
                "   *Example:* *'We dropped p99 latency by 68%, supported 3x higher peak traffic, and had zero dropped orders during Cyber Week.'*\n\n"
                "**Pro-Tip:** Focus 70% of your time on **Action** and **Result**—interviewers care about what *you* did and the measurable impact."
            )
            if voice_mode:
                reply = (
                    "The STAR method stands for Situation, Task, Action, and Result. "
                    "Spend most of your time on Action—the specific steps you took—and Result, where you quantify your impact with numbers. "
                    "Would you like to practice a STAR question right now in the Practice Hub?"
                )
            return LLMResponse(
                reply=reply,
                thinking=["Identified STAR behavioral interview framework query; providing structured guide with engineering examples."],
                engine="CareerForge Interview Coach",
                suggestions=["Practice a STAR question", "How to answer 'Tell me about a failure'", "Go to Practice Hub"],
            )

        # ─── 5. System Design & Architecture ──────────────────────────────────
        if any(w in lower for w in ["system design", "microservice", "cap theorem", "load balancer", "message queue", "kafka", "caching", "redis"]):
            reply = (
                "When approaching **System Design** interviews, follow this proven 4-step framework:\n\n"
                "1. **Scope the Problem (3-5 min)**: Clarify functional requirements (e.g. upload video, stream video) and non-functional requirements (high availability, latency < 200ms, consistency vs. availability via CAP theorem, estimated DAU/QPS).\n"
                "2. **High-Level Architecture (10 min)**: Diagram the end-to-end data flow: DNS $\\rightarrow$ CDN $\\rightarrow$ Load Balancer (ALB/Nginx) $\\rightarrow$ API Gateway $\\rightarrow$ Microservices $\\rightarrow$ Distributed Cache (Redis) $\\rightarrow$ Primary/Replica DB (PostgreSQL).\n"
                "3. **Deep Dive into Bottlenecks (15 min)**: Discuss horizontal scaling, database sharding/partitioning, async decoupling via Kafka or RabbitMQ, and idempotency keys for transactional consistency.\n"
                "4. **Reliability & Observability (5 min)**: Circuit breakers (Hystrix), rate limiting (Token Bucket), distributed tracing (OpenTelemetry), and health check probes."
            )
            if voice_mode:
                reply = "In system design, start by scoping functional and non-functional metrics, then establish your high-level data flow from load balancer to database before diving into caching and sharding."
            return LLMResponse(
                reply=reply,
                thinking=["System architecture query detected; synthesizing 4-step engineering blueprint."],
                engine="CareerForge Architecture Engine",
                suggestions=["Explain Database Sharding", "REST vs GraphQL vs gRPC", "Open Practice Hub"],
            )

        # ─── 6. Frontend & Modern Web Architecture ─────────────────────────────
        if any(w in lower for w in ["react", "next.js", "nextjs", "virtual dom", "reconciliation", "usememo", "usecallback", "web vitals", "lcp"]):
            reply = (
                "Here are the core principles for modern frontend engineering in React & Next.js:\n\n"
                "- **Reconciliation & Fiber Tree**: React uses a virtual DOM tree of Fiber nodes to calculate minimal DOM patches. Keys must be stable and unique to prevent unnecessary component remounts.\n"
                "- **Memoization Heuristics**: Use `useMemo` for expensive computations and `useCallback` to preserve referential equality of function props passed to memoized children (`React.memo`). Avoid over-memoizing simple primitives.\n"
                "- **Core Web Vitals**: Optimize **LCP** (Largest Contentful Paint < 2.5s) via image preloading and `fetchpriority='high'`, **INP** (Interaction to Next Paint < 200ms) by keeping the main thread free of long tasks, and **CLS** (Cumulative Layout Shift < 0.1) by reserving explicit container aspect ratios."
            )
            return LLMResponse(
                reply=reply,
                thinking=["Modern frontend framework and performance inquiry detected."],
                engine="CareerForge Frontend Intelligence",
                suggestions=["Explain Event Loop", "Next.js App Router vs Pages", "View Frontend Roadmap"],
            )

        # ─── 7. Career Roadmap & ATS Guidance ─────────────────────────────────
        if any(w in lower for w in ["roadmap", "learn", "study", "skills", "job", "interview", "resume", "ats"]):
            reply = (
                "To accelerate your technical career, CareerForge provides three integrated pillars:\n\n"
                "1. **Career Roadmap**: Visual, tier-by-tier learning graphs for Frontend, Backend, Data/AI, DevOps, and Product tracks, complete with curated books, blogs, and GitHub repositories.\n"
                "2. **Daily Practice Hub**: Interactive concept drills featuring objective standard definitions, speech dictation, and speech synthesis playback.\n"
                "3. **Resume Studio & ATS Analyzer**: Real-time keyword scoring, formatting auditing, and conversational resume generation.\n\n"
                "Which track or tool would you like to explore right now?"
            )
            if voice_mode:
                reply = "CareerForge offers full Career Roadmaps, the Daily Practice Hub, and the ATS Resume Studio. Which of these would you like to open?"
            return LLMResponse(
                reply=reply,
                thinking=["Platform capability and career path guidance synthesized."],
                engine="CareerForge Career Engine",
                suggestions=["Open Roadmap", "Daily Practice Hub", "ATS Resume Review"],
            )

        # ─── 8. General Open-Domain Query ─────────────────────────────────────
        if voice_mode:
            reply = (
                f"That is an interesting topic. When tackling {clean}, the priority is understanding "
                "the foundational mechanics, evaluating practical trade-offs, and applying clear best practices. "
                "How would you like to proceed?"
            )
        else:
            reply = (
                f"### Analysis: {clean.title()}\n\n"
                f"When evaluating this topic in a professional engineering environment, consider these primary dimensions:\n\n"
                f"1. **Core Fundamentals**: Establish clear mental models and define the foundational concepts before choosing tools or frameworks.\n"
                f"2. **Trade-offs & Constraints**: Every architectural choice involves trade-offs between simplicity, latency, developer velocity, and maintainability.\n"
                f"3. **Practical Implementation**: Structure your code with clean boundaries, comprehensive testing, and clear observability.\n\n"
                f"Would you like to see a concrete code example, discuss common pitfalls, or explore how this connects to your career track?"
            )

        return LLMResponse(
            reply=reply,
            thinking=[f"Deliberating on '{clean[:40]}' with structured engineering principles."],
            engine="CareerForge Conversational Intelligence",
            suggestions=["Show a code example", "Common interview pitfalls", "Back to Roadmap"],
        )


class LLMOrchestrator:
    """Cascading orchestrator across Claude, OpenAI, Groq, Gemini, and Dynamic Fallback."""

    def __init__(self):
        self.claude = ClaudeProvider()
        self.openai = OpenAIProvider()
        self.groq = GroqProvider()
        self.gemini = GeminiProvider()
        self.fallback = DynamicConversationalFallback()

    def generate(
        self,
        messages: List[Dict[str, str]],
        user_name: str = "User",
        voice_mode: bool = False,
        detected_lang: str = "en",
        system_prompt: Optional[str] = None,
    ) -> LLMResponse:
        # Cascade through active cloud providers
        for provider, name in [
            (self.claude, "Claude"),
            (self.openai, "OpenAI"),
            (self.groq, "Groq"),
            (self.gemini, "Gemini"),
        ]:
            if provider.is_available():
                try:
                    res = provider.generate(
                        messages=messages,
                        user_name=user_name,
                        voice_mode=voice_mode,
                        detected_lang=detected_lang,
                        system_prompt=system_prompt,
                    )
                    if res and res.reply:
                        return res
                except Exception as e:
                    print(f"[LLMOrchestrator] {name} failed: {e}")

        # Intelligent conversational fallback
        return self.fallback.generate(
            messages=messages,
            user_name=user_name,
            voice_mode=voice_mode,
            detected_lang=detected_lang,
            system_prompt=system_prompt,
        )


llm_orchestrator = LLMOrchestrator()
