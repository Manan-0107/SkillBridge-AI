"use client";

import { FormEvent, useRef, useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { parseIntent, FeatureId, ResumeTab, ParsedIntent } from "@/lib/intent";

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: ParsedIntent;
  redirecting?: boolean;
};

const quickPills = [
  { label: "Check Roadmap", prompt: "Show me my career roadmap" },
  { label: "Find Courses", prompt: "Recommend the best courses for my role" },
  { label: "Interview Practice", prompt: "I want to practice interview questions" },
  { label: "Analyze Resume", prompt: "Help me audit my resume" },
  { label: "Local Jobs", prompt: "Show local jobs and meetups near me" },
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
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Dynamic, calm & friendly greeting
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

    setMessages([
      {
        id: "intro-1",
        role: "assistant",
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
        text: "Staying here in chat. What else would you like to know?",
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

    const userMsgId = `user-${Date.now()}`;
    const userMsgText = prompt.trim();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", text: userMsgText }]);
    scrollToBottom();

    const intent = parseIntent(userMsgText);
    if (intent.role) setTargetRole(intent.role);

    window.setTimeout(() => {
      const assistantMsgId = `ai-${Date.now()}`;
      const hasFeature = Boolean(intent.feature);

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
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
    }, 400);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = input;
    setInput("");
    runPrompt(value);
  };

  const emptyThread = messages.length <= 1;

  const userDisplayName = user?.name
    ? user.name.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : null;

  return (
    <div className="flex min-h-[calc(100vh-4.25rem)] flex-col bg-paper">
      {/* Scrollable Chat Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="app-shell flex flex-col py-10 md:py-16 max-w-4xl mx-auto">
          {emptyThread && (
            <div className="mb-10 text-center space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3.5 py-1.5 text-xs font-medium text-graphite shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                CareerForge AI Assistant &bull; Online
              </div>
              
              <h1 className="font-display text-3xl italic text-ink md:text-5xl tracking-tight">
                {userDisplayName ? `Hello, ${userDisplayName}` : "How can I help you today?"}
              </h1>
              
              <p className="mx-auto max-w-md text-sm text-graphite leading-relaxed">
                Ask any question or choose an option below to get started.
              </p>
            </div>
          )}

          {/* Conversation Stream */}
          <div className="space-y-4 w-full">
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper text-xs font-semibold shadow-sm">
                      AI
                    </div>
                  )}

                  <div className={`max-w-[85%] space-y-3`}>
                    <div
                      className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "bg-ink text-paper"
                          : "border border-line bg-white text-ink"
                      }`}
                    >
                      <p>{m.text}</p>
                    </div>

                    {/* Clean Action Card */}
                    {m.intent?.feature && (
                      <div className="rounded-xl border border-line bg-neutral-50/90 p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink">
                            {m.intent.featureTitle || "Workspace Tool"}
                          </span>
                          {m.redirecting && redirectCountdown !== null && (
                            <span className="text-xs text-amber-700 font-medium animate-pulse">
                              Opening in 2s…
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          {m.redirecting && (
                            <button
                              type="button"
                              onClick={cancelRedirect}
                              className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-graphite hover:bg-neutral-100 hover:text-ink transition-colors"
                            >
                              Stay in Chat
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => executeRedirect(m.intent!.feature!, m.intent!.resumeTab)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-medium text-paper hover:bg-neutral-800 transition-colors shadow-sm"
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

                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-ink text-xs font-semibold">
                      {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}
                </div>
              );
            })}

            {busy && redirectCountdown === null && (
              <div className="flex items-center gap-2 text-xs text-graphite pl-11">
                <span className="h-1.5 w-1.5 rounded-full bg-graphite animate-ping" />
                Thinking…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clean AI Input Bar */}
      <div className="sticky bottom-0 border-t border-line bg-paper/95 pb-6 pt-3.5 backdrop-blur">
        <div className="app-shell max-w-4xl mx-auto">
          <div>
            <form
              onSubmit={onSubmit}
              className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm focus-within:border-ink focus-within:ring-1 focus-within:ring-ink transition-all"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
                rows={1}
                placeholder="Ask me anything or choose a topic below..."
                className="max-h-36 min-h-[44px] flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-graphite/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition-all hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                title="Send"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>

            {/* Peaceful, Friendly Prompt Chips */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
              {quickPills.map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => runPrompt(pill.prompt)}
                  className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs text-graphite hover:border-ink hover:text-ink hover:bg-neutral-50 transition-all shadow-xs"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
