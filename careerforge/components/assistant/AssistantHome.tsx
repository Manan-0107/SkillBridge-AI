"use client";

import { FormEvent, useRef, useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { FeatureId, ResumeTab, ParsedIntent } from "@/lib/intent";

export type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time?: string;
  intent?: ParsedIntent;
  redirecting?: boolean;
};

export interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  archived?: boolean;
}

const STORAGE_KEY = "careerforge.conversations";

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"all" | "pinned" | "archived">("all");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const userDisplayName = user?.name
    ? user.name.split(" ")[0]
    : user?.email
    ? user.email.split("@")[0]
    : "there";

  // ─── 1. Load Conversations from LocalStorage ────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Conversation[] = JSON.parse(raw);
        if (parsed.length > 0) {
          setConversations(parsed);
          const firstActive = parsed.find((c) => !c.archived) || parsed[0];
          setActiveConvId(firstActive.id);
          return;
        }
      }
    } catch {
      // ignore
    }

    // Create Initial Default Conversation
    createNewConversation();
  }, [user?.name, user?.email]);

  // ─── 2. Persist Conversations ───────────────────────────────────────────────
  const saveConversations = (updated: Conversation[]) => {
    setConversations(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const getGreetingMessage = (): Msg => {
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return {
      id: "intro-1",
      role: "assistant",
      time: now,
      text: `${timeOfDay}, ${userDisplayName}! 👋 I'm your CareerForge AI Copilot. What would you like to work on today?`,
    };
  };

  // ─── 3. New Chat Action ────────────────────────────────────────────────────
  const createNewConversation = () => {
    const newId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      title: "New Career Chat",
      messages: [getGreetingMessage()],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      archived: false,
    };

    const updated = [newConv, ...conversations.filter((c) => c.id !== newId)];
    saveConversations(updated);
    setActiveConvId(newId);
    setInput("");
  };

  // Active conversation helper
  const activeConversation =
    conversations.find((c) => c.id === activeConvId) || conversations[0] || null;
  const messages = activeConversation?.messages || [];

  // ─── 4. Conversation Actions (Pin, Archive, Delete) ─────────────────────────
  const togglePin = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = conversations.map((c) =>
      c.id === convId ? { ...c, pinned: !c.pinned } : c
    );
    saveConversations(updated);
  };

  const toggleArchive = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = conversations.map((c) =>
      c.id === convId ? { ...c, archived: !c.archived } : c
    );
    saveConversations(updated);
    // If archiving the active chat, switch to another non-archived chat
    if (convId === activeConvId) {
      const next = updated.find((c) => !c.archived);
      if (next) setActiveConvId(next.id);
      else createNewConversation();
    }
  };

  const deleteConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = conversations.filter((c) => c.id !== convId);
    if (filtered.length === 0) {
      createNewConversation();
    } else {
      saveConversations(filtered);
      if (convId === activeConvId) {
        setActiveConvId(filtered[0].id);
      }
    }
  };

  // ─── 5. Auto Scroll & Timers ────────────────────────────────────────────────
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
  };

  const executeRedirect = (feature: FeatureId, tab?: ResumeTab) => {
    if (activeTimer) clearTimeout(activeTimer);
    setRedirectCountdown(null);
    setBusy(false);
    onRedirect(feature, tab);
  };

  // ─── 6. Send Prompt via LLM Backend ─────────────────────────────────────────
  const runPrompt = async (prompt: string) => {
    if (!prompt.trim() || busy || !activeConversation) return;
    setBusy(true);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `user-${Date.now()}`;
    const userMsgText = prompt.trim();

    // Derive chat title from first user prompt if new
    let chatTitle = activeConversation.title;
    if (chatTitle === "New Career Chat" || chatTitle === "New Conversation") {
      chatTitle = userMsgText.slice(0, 36) + (userMsgText.length > 36 ? "…" : "");
    }

    const nextMessages: Msg[] = [
      ...messages,
      { id: userMsgId, role: "user", text: userMsgText, time: now },
    ];

    // Optimistically update state
    const updatedConv: Conversation = {
      ...activeConversation,
      title: chatTitle,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    };

    const updatedList = conversations.map((c) =>
      c.id === activeConversation.id ? updatedConv : c
    );
    saveConversations(updatedList);
    scrollToBottom();

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          userProfile: {
            name: user?.name,
            email: user?.email,
            targetRole: user?.targetRole || undefined,
          },
          targetRole: user?.targetRole || "frontend",
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");
      const data = await res.json();

      const replyText =
        data.reply ||
        "I'm here to support your career journey. What would you like to explore next?";
      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const hasFeature = Boolean(data.feature);

      const intent: ParsedIntent = {
        feature: data.feature || null,
        featureTitle: data.featureTitle,
        resumeTab: data.resumeTab,
        reply: replyText,
      };

      if (data.role) setTargetRole(data.role);

      const finalMessages: Msg[] = [
        ...nextMessages,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          time: replyTime,
          text: replyText,
          intent,
          redirecting: hasFeature,
        },
      ];

      const finalizedConv: Conversation = {
        ...updatedConv,
        messages: finalMessages,
        updatedAt: new Date().toISOString(),
      };

      saveConversations(
        conversations.map((c) => (c.id === finalizedConv.id ? finalizedConv : c))
      );
      scrollToBottom();

      if (hasFeature && data.feature) {
        setRedirectCountdown(3);
        const timer = setTimeout(() => {
          executeRedirect(data.feature, data.resumeTab);
        }, 3200);
        setActiveTimer(timer);
      } else {
        setBusy(false);
      }
    } catch (err) {
      console.error("[AssistantHome] LLM call error:", err);
      const fallbackMessages: Msg[] = [
        ...nextMessages,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          text: "I am right here with you. Would you like to review your career roadmap, find top courses, or practice interview questions?",
        },
      ];
      saveConversations(
        conversations.map((c) =>
          c.id === updatedConv.id ? { ...updatedConv, messages: fallbackMessages } : c
        )
      );
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = input;
    setInput("");
    runPrompt(value);
  };

  // ─── 7. Voice Dictation (Web Speech API) ────────────────────────────────────
  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice dictation is supported in Chrome, Edge, and Safari.");
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
      setIsListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const speechResult = event.results?.[0]?.[0]?.transcript || "";
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

  // Filter conversations based on sidebar tab
  const filteredConversations = conversations.filter((c) => {
    if (sidebarTab === "pinned") return c.pinned && !c.archived;
    if (sidebarTab === "archived") return c.archived;
    return !c.archived;
  });

  const emptyThread = messages.length <= 1;

  return (
    <div className="flex h-[calc(100vh-4.25rem)] overflow-hidden bg-[#FDFDFB]">
      
      {/* ─── LEFT AI CHAT SIDEBAR (Shown only when in AI Assistant) ───────────── */}
      <aside
        className={`flex flex-col border-r border-neutral-200 bg-white transition-all duration-200 z-20 ${
          sidebarOpen ? "w-72 sm:w-80 shrink-0" : "w-0 -translate-x-full overflow-hidden border-none"
        }`}
      >
        {/* Sidebar Header & New Chat Button */}
        <div className="p-3.5 border-b border-neutral-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Conversations
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 sm:hidden"
              title="Close sidebar"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            onClick={createNewConversation}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-2.5 px-3 text-xs font-semibold text-white shadow-xs hover:bg-black transition-all"
          >
            <span className="text-base font-bold">+</span>
            <span>New Career Chat</span>
          </button>

          {/* Filter Tabs: All / Pinned / Archived */}
          <div className="flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setSidebarTab("all")}
              className={`flex-1 py-1 rounded transition-colors ${
                sidebarTab === "all"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              All ({conversations.filter((c) => !c.archived).length})
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("pinned")}
              className={`flex-1 py-1 rounded transition-colors ${
                sidebarTab === "pinned"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              ⭐ Pinned ({conversations.filter((c) => c.pinned && !c.archived).length})
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("archived")}
              className={`flex-1 py-1 rounded transition-colors ${
                sidebarTab === "archived"
                  ? "bg-white text-neutral-900 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              📦 Archive
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-400">
              {sidebarTab === "pinned"
                ? "No pinned conversations yet. Click ⭐ to pin."
                : sidebarTab === "archived"
                ? "No archived conversations."
                : "No previous chats."}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                    isActive
                      ? "bg-neutral-100 font-semibold text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    {conv.pinned && <span className="text-amber-500 shrink-0">⭐</span>}
                    <span className="truncate">{conv.title}</span>
                  </div>

                  {/* Actions on Hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Pin Action */}
                    <button
                      type="button"
                      onClick={(e) => togglePin(conv.id, e)}
                      title={conv.pinned ? "Unpin chat" : "Pin chat to top"}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-amber-600"
                    >
                      ⭐
                    </button>

                    {/* Archive Action */}
                    <button
                      type="button"
                      onClick={(e) => toggleArchive(conv.id, e)}
                      title={conv.archived ? "Unarchive chat" : "Archive chat"}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800"
                    >
                      📦
                    </button>

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      title="Delete chat"
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ─── MAIN CHAT & CONVERSATION VIEW ──────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        
        {/* Top Chat Toolbar with Sidebar Toggle */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-xs"
              title="Toggle Chats Sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>{sidebarOpen ? "Hide Chats" : "Show Chats"}</span>
            </button>

            <span className="text-xs font-semibold text-neutral-800 truncate max-w-[200px] sm:max-w-md">
              {activeConversation?.title || "Career Copilot"}
            </span>
          </div>

          <button
            type="button"
            onClick={createNewConversation}
            className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            title="Start new chat"
          >
            <span>+ New</span>
          </button>
        </div>

        {/* Scrollable Conversation Stream */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col px-4 py-8 md:py-12">
            {emptyThread && (
              <div className="mb-8 text-center space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 shadow-xs">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>AI Career Assistant &bull; Online</span>
                </div>

                <h1 className="font-display text-3xl italic text-ink md:text-4xl tracking-tight">
                  {userDisplayName ? `Hello, ${userDisplayName}` : "How can I help you today?"}
                </h1>

                <p className="mx-auto max-w-md text-xs text-graphite leading-relaxed">
                  Powered by real open-source &amp; GitHub LLMs. Ask any career question below.
                </p>
              </div>
            )}

            {/* Message Stream */}
            <div className="space-y-6 w-full">
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-neutral-400 px-1">
                      <span>{isUser ? userDisplayName : "CareerForge AI"}</span>
                      {m.time && <span>&bull; {m.time}</span>}
                    </div>

                    <div className="space-y-2 max-w-[90%] sm:max-w-[80%]">
                      <div
                        className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                          isUser
                            ? "bg-ink text-paper rounded-tr-xs shadow-sm font-normal"
                            : "border border-neutral-200/80 bg-white text-ink rounded-tl-xs shadow-xs"
                        }`}
                      >
                        <p className="whitespace-pre-line">{m.text}</p>
                      </div>

                      {/* Interactive Action Card if AI recommended a workspace tool */}
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
                                Opening in 3s…
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
                  </div>
                );
              })}

              {/* AI Thinking Animation */}
              {busy && redirectCountdown === null && (
                <div className="flex flex-col items-start">
                  <div className="mb-1 text-[11px] font-medium text-neutral-400 px-1">
                    CareerForge AI is thinking…
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

        {/* Floating AI Prompt Composer */}
        <div className="border-t border-neutral-200/80 bg-white/95 px-4 pb-6 pt-3.5 backdrop-blur-md">
          <div className="mx-auto max-w-3xl space-y-3">
            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2 rounded-2xl border border-neutral-300 bg-neutral-50/80 p-2 shadow-sm focus-within:border-neutral-900 focus-within:bg-white focus-within:ring-2 focus-within:ring-neutral-900/10 transition-all"
            >
              <button
                type="button"
                onClick={toggleVoiceInput}
                title={isListening ? "Listening... (Click to stop)" : "Voice input (Speak prompt)"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                }`}
              >
                <MicIcon className="h-4.5 w-4.5" />
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening... Speak now" : "Ask CareerForge AI anything (or speak)..."}
                className="min-h-[40px] flex-1 bg-transparent px-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />

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
          </div>
        </div>
      </div>
    </div>
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
