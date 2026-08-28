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

const explorationCards = [
  {
    icon: (
      <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    title: "Career Roadmap",
    desc: "Explore step-by-step milestones & skill trees for your target role.",
    prompt: "Show me my career roadmap and what skills to learn next",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: "Curated Courses",
    desc: "Find hand-picked tutorials, courses, and recognized certifications.",
    prompt: "Recommend the best courses and certifications for my role",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Interview Practice",
    desc: "Drill coding challenges, system design, and behavioral mock questions.",
    prompt: "I want to practice interview questions and coding challenges",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Local Opportunities",
    desc: "Find active job openings, internships, and tech meetups in your area.",
    prompt: "Show local jobs, internships, and tech meetups near me",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Resume Suite",
    desc: "Draft a fresh resume, personalize for roles, or scan ATS score.",
    prompt: "Help me build or personalize my resume",
  },
];

export function AssistantHome({
  onRedirect,
}: {
  onRedirect: (feature: FeatureId, resumeTab?: ResumeTab) => void;
}) {
  const { user, setTargetRole } = useApp();
  const firstName = user?.name?.split(" ")[0] || "there";
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timeout | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Hello ${firstName}! I'm your CareerForge AI Copilot. Tell me what you'd like to achieve — plan a learning roadmap, find courses, practice for interviews, explore local opportunities, or polish your resume — and I'll guide you directly there.`,
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, redirectCountdown]);

  const cancelRedirect = () => {
    if (activeTimer) {
      clearTimeout(activeTimer);
      setActiveTimer(null);
    }
    setRedirectCountdown(null);
    setBusy(false);
    setMessages((prev) =>
      prev.map((m) => (m.redirecting ? { ...m, redirecting: false } : m))
    );
  };

  const executeRedirect = (feature: FeatureId, resumeTab?: ResumeTab) => {
    if (activeTimer) clearTimeout(activeTimer);
    setRedirectCountdown(null);
    setBusy(false);
    onRedirect(feature, resumeTab);
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

    // Simulate conversational AI processing
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

  return (
    <div className="flex min-h-[calc(100vh-4.25rem)] flex-col bg-paper">
      {/* Scrollable Chat / AI Exploration Area */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col px-4 py-8 md:py-12">
          {emptyThread && (
            <div className="mb-8 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3.5 py-1 text-xs font-medium text-graphite shadow-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                CareerForge AI Copilot &bull; Ready
              </div>
              <h1 className="mt-4 font-display text-3xl italic text-ink md:text-5xl">
                What are you looking to work on?
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm text-graphite leading-relaxed">
                Ask in natural language. I’ll provide personalized guidance and take you straight to the right workspace tools.
              </p>
            </div>
          )}

          {/* Conversation Stream */}
          <div className="space-y-4">
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
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "bg-ink text-paper"
                          : "border border-line bg-white text-ink"
                      }`}
                    >
                      <p>{m.text}</p>
                    </div>

                    {/* Feature Navigation Card */}
                    {m.intent?.feature && (
                      <div className="rounded-xl border border-line bg-neutral-50/90 p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-ink/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink">
                              {m.intent.badge || "Workspace Tool"}
                            </span>
                            <span className="text-xs font-medium text-graphite">
                              {m.intent.featureTitle || m.intent.feature}
                            </span>
                          </div>
                          {m.redirecting && redirectCountdown !== null && (
                            <span className="text-xs text-amber-700 font-medium animate-pulse">
                              Redirecting in 2s…
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
                            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-medium text-paper hover:bg-neutral-800 transition-colors shadow-sm"
                          >
                            <span>Open {m.intent.featureTitle || "Feature"}</span>
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
                AI is thinking…
              </div>
            )}
          </div>

          {/* Quick Exploration Cards (when empty thread) */}
          {emptyThread && (
            <div className="mt-8 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-graphite text-center">
                Explore Career Modules
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {explorationCards.map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => runPrompt(card.prompt)}
                    className="flex flex-col text-left rounded-xl border border-line bg-white/70 p-4 transition-all hover:border-ink hover:bg-white hover:shadow-md group"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="p-1.5 rounded-lg bg-neutral-100 group-hover:bg-neutral-200 transition-colors">
                        {card.icon}
                      </div>
                      <p className="text-sm font-semibold text-ink group-hover:text-black">
                        {card.title}
                      </p>
                    </div>
                    <p className="text-xs text-graphite leading-relaxed flex-1">
                      {card.desc}
                    </p>
                    <span className="mt-3 inline-flex items-center text-[11px] font-medium text-ink group-hover:translate-x-0.5 transition-transform">
                      Try prompt &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Prompt Input Bar */}
      <div className="sticky bottom-0 border-t border-line bg-paper/95 pb-6 pt-3.5 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4">
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
              placeholder="Ask anything (e.g., 'Show my roadmap', 'Find React courses', 'Practice interview questions', 'Jobs near me')..."
              className="max-h-36 min-h-[44px] flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-graphite/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition-all hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              title="Send prompt"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>

          {/* Quick pills */}
          <div className="mt-2.5 flex items-center justify-center gap-2 overflow-x-auto text-[11px] text-graphite py-0.5">
            <span className="text-[11px] text-graphite/70 font-medium">Quick suggestions:</span>
            {[
              "Show my roadmap",
              "Find courses",
              "Interview prep",
              "Local opportunities",
              "Resume builder",
            ].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => runPrompt(tag)}
                className="whitespace-nowrap rounded-md border border-line bg-white/60 px-2 py-0.5 text-graphite hover:border-ink hover:text-ink transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
