"use client";

import { FormEvent, useRef, useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { parseIntent, FeatureId, ResumeTab, ParsedIntent } from "@/lib/intent";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time?: string;
  intent?: ParsedIntent;
  redirecting?: boolean;
};

const quickPills = [
  { label: "🗺️ Check Roadmap", prompt: "Show me my career roadmap" },
  { label: "📚 Find Courses", prompt: "Recommend the best courses for my role" },
  { label: "🎯 Interview Practice", prompt: "I want to practice interview questions" },
  { label: "📄 Audit Resume", prompt: "Help me audit my resume" },
  { label: "📍 Local Jobs", prompt: "Show local jobs and meetups near me" },
];

export function AssistantHome({
  onRedirect,
}: {
  onRedirect: (feature: FeatureId, tab?: ResumeTab) => void;
}) {
  const { user, setTargetRole } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Dynamic friendly greeting
  useEffect(() => {
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    let displayName = "there";
    if (user?.name && user.name.trim()) {
      displayName = user.name.trim().split(" ")[0];
    } else if (user?.email) {
      const raw = user.email.split("@")[0];
      displayName = raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages([
      {
        id: "intro-1",
        role: "assistant",
        time: now,
        text: `${timeOfDay}, ${displayName}! 👋 How can I help you with your career today?`,
      },
    ]);
  }, [user?.name, user?.email]);

  // Countdown timer effect
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [redirectCountdown]);

  const scrollToBottom = () => {
    window.setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 50);
  };

  const cancelRedirect = () => {
    if (activeTimer) clearTimeout(activeTimer);
    setRedirectCountdown(null);
    setBusy(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `cancelled-${Date.now()}`,
        role: "assistant",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: "Staying in chat. What else can I assist you with?",
      },
    ]);
  };

  const executeRedirect = (feature: FeatureId, tab?: ResumeTab) => {
    if (activeTimer) clearTimeout(activeTimer);
    setRedirectCountdown(null);
    setBusy(false);
    onRedirect(feature, tab);
  };

  const runPrompt = (prompt: string) => {
    if (!prompt.trim() || busy) return;
    setBusy(true);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `user-${Date.now()}`;
    const userMsgText = prompt.trim();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", text: userMsgText, time: now }]);
    scrollToBottom();

    const intent = parseIntent(userMsgText);
    if (intent.role) setTargetRole(intent.role);

    window.setTimeout(() => {
      const assistantMsgId = `ai-${Date.now()}`;
      const hasFeature = Boolean(intent.feature);
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          time: replyTime,
          text: intent.reply,
          intent,
          redirecting: hasFeature,
        },
      ]);
      scrollToBottom();

      if (hasFeature && intent.feature) {
        const featureToOpen = intent.feature;
        const tabToOpen = intent.resumeTab;

        setRedirectCountdown(2);
        const timer = setTimeout(() => {
          executeRedirect(featureToOpen, tabToOpen);
        }, 2200);
        setActiveTimer(timer);
      } else {
        setBusy(false);
      }
    }, 450);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = input;
    setInput("");
    runPrompt(value);
  };

  // Accessibility: Voice to Text dictation for users with motor or visual disabilities
  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is supported in Chrome, Edge, and Safari.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);
      recognition.onresult = (event: { results: { [x: string]: { [x: string]: { transcript: string; }; }; }; }) => {
        const speechResult = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${speechResult}` : speechResult));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const emptyThread = messages.length <= 1;

  const userDisplayName = user?.name
    ? user.name.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : null;

  return (
    <div className="flex min-h-[calc(100vh-4.25rem)] flex-col bg-[#FDFDFB]">
      {/* ─── Conversational AI Chat Area ───────────────────────────────────── */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col px-4 py-8 md:py-12">
          
          {/* AI Status Header */}
          {emptyThread && (
            <div className="mb-8 text-center space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 shadow-xs">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>AI Career Assistant &bull; Online</span>
              </div>

              <h1 className="font-display text-3xl italic text-ink md:text-4xl tracking-tight">
                {userDisplayName ? `Welcome back, ${userDisplayName}` : "How can I help you today?"}
              </h1>

              <p className="mx-auto max-w-md text-xs text-graphite leading-relaxed">
                Your empathetic career companion. Ask questions or select an action below.
              </p>
            </div>
          )}

          {/* Messages Stream */}
          <div className="space-y-6 w-full">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {/* AI Spark Avatar */}
                  {!isUser && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-neutral-900 via-neutral-800 to-neutral-700 text-white shadow-sm ring-1 ring-black/5">
                      <SparklesIcon className="h-4.5 w-4.5 text-amber-300" />
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div className={`space-y-2 max-w-[85%] sm:max-w-[78%]`}>
                    
                    {/* Role / Timestamp Header */}
                    <div className={`flex items-center gap-2 text-[11px] font-medium text-neutral-400 ${isUser ? "justify-end" : "justify-start"}`}>
                      <span>{isUser ? (userDisplayName || "You") : "CareerForge Copilot"}</span>
                      {m.time && <span>&bull; {m.time}</span>}
                    </div>

                    {/* Chat Bubble */}
                    <div
                      className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                        isUser
                          ? "bg-ink text-paper rounded-tr-xs shadow-sm font-normal"
                          : "border border-neutral-200/80 bg-white text-ink rounded-tl-xs shadow-xs"
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.text}</p>
                    </div>

                    {/* Interactive Action Card if AI detected a feature intent */}
                    {m.intent?.feature && (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 shadow-xs space-y-2.5 animate-in fade-in zoom-in-98 duration-150">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-blue-500" />
                            <span className="text-xs font-semibold text-neutral-900">
                              {m.intent.featureTitle || "Workspace Tool"}
                            </span>
                          </div>
                          {m.redirecting && redirectCountdown !== null && (
                            <span className="text-[11px] font-semibold text-amber-700 animate-pulse">
                              Opening tool in 2s…
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-200/60">
                          {m.redirecting && (
                            <button
                              type="button"
                              onClick={cancelRedirect}
                              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-ink transition-colors"
                            >
                              Stay in Chat
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => executeRedirect(m.intent!.feature!, m.intent!.resumeTab)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors shadow-sm"
                          >
                            <span>Open {m.intent.featureTitle || "Tool"}</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User Avatar */}
                  {isUser && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-200 text-neutral-800 text-xs font-bold shadow-xs">
                      {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}
                </div>
              );
            })}

            {/* AI Typing Animated Indicator */}
            {busy && redirectCountdown === null && (
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-neutral-900 via-neutral-800 to-neutral-700 text-white shadow-sm">
                  <SparklesIcon className="h-4.5 w-4.5 text-amber-300 animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-xs border border-neutral-200 bg-white px-4 py-3 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Floating AI Prompt Composer ────────────────────────────────────── */}
      <div className="sticky bottom-0 border-t border-neutral-200/80 bg-white/95 px-4 pb-6 pt-3.5 backdrop-blur-md">
        <div className="mx-auto max-w-3xl space-y-3">
          
          {/* Modern Rounded AI Composer Box */}
          <form
            onSubmit={onSubmit}
            className="flex items-center gap-2 rounded-2xl border border-neutral-300 bg-neutral-50/80 p-2 shadow-sm focus-within:border-neutral-900 focus-within:bg-white focus-within:ring-2 focus-within:ring-neutral-900/10 transition-all"
          >
            {/* Voice Dictation Button (Crucial Accessibility for Motor Disabilities) */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={isListening ? "Listening... (Click to stop)" : "Voice input (Speak your prompt)"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
              }`}
            >
              <MicIcon className="h-4.5 w-4.5" />
            </button>

            {/* Prompt Text Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening... Speak now" : "Ask CareerForge AI anything (or speak)..."}
              className="min-h-[40px] flex-1 bg-transparent px-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-all hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
              title="Send message"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>

          {/* Quick Helpful Prompt Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {quickPills.map((pill) => (
              <button
                key={pill.label}
                type="button"
                onClick={() => runPrompt(pill.prompt)}
                className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 hover:bg-neutral-50 transition-all shadow-xs"
              >
                {pill.label}
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-neutral-400">
            CareerForge AI is designed for assistive accessibility and career empowerment.
          </p>
        </div>
      </div>
    </div>
  );
}

function SparklesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function MicIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}
