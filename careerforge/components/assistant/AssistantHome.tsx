"use client";

import { FormEvent, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { parseIntent, FeatureId, ResumeTab } from "@/lib/intent";
import { PrimaryButton } from "@/components/ui/Primitives";

type Msg = { id: string; role: "user" | "assistant"; text: string };

const starters: { label: string; prompt: string }[] = [
  { label: "Analyze my resume", prompt: "Analyze my resume against the market" },
  { label: "Build a resume", prompt: "Help me build a resume from scratch" },
  { label: "Show my roadmap", prompt: "Show me a career roadmap" },
  { label: "Find courses", prompt: "Find courses for my target role" },
  { label: "Practice interviews", prompt: "I want to practice for interviews" },
  { label: "Jobs near me", prompt: "Show local jobs and internships near me" },
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
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Welcome, ${firstName}. Tell me what you want to work on — resume, roadmap, courses, practice, or local opportunities — and I’ll take you there.`,
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  const push = (msg: Omit<Msg, "id">) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` },
    ]);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const runPrompt = (prompt: string) => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    push({ role: "user", text: prompt.trim() });

    const intent = parseIntent(prompt);
    if (intent.role) setTargetRole(intent.role);

    window.setTimeout(() => {
      push({ role: "assistant", text: intent.reply });
      if (intent.feature) {
        window.setTimeout(() => {
          onRedirect(intent.feature!, intent.resumeTab);
          setBusy(false);
        }, 700);
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

  const emptyThread = messages.length <= 1;

  return (
    <div className="flex min-h-[calc(100vh-4.25rem)] flex-col">
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col px-6 py-10 md:py-16">
          {emptyThread && (
            <div className="mb-10 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite">
                Assistant
              </p>
              <h1 className="mt-3 font-display text-3xl italic text-ink md:text-5xl">
                What should we work on?
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm text-graphite">
                Ask in plain language. I’ll route you to the right CareerForge tool.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-ink text-paper"
                      : "border border-line bg-white/70 text-ink"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {emptyThread && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => runPrompt(s.prompt)}
                  className="rounded-full border border-line bg-white/60 px-3.5 py-2 text-[13px] font-medium text-graphite transition-colors hover:border-ink hover:text-ink"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-paper/90 pb-6 pt-4 backdrop-blur">
        <form
          onSubmit={onSubmit}
          className="mx-auto flex max-w-2xl items-end gap-2 px-6"
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
            placeholder="Ask CareerForge…"
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-graphite/60 focus:border-ink"
          />
          <PrimaryButton type="submit" disabled={busy || !input.trim()}>
            Send
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
