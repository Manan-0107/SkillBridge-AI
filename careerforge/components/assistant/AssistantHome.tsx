"use client";

import { FormEvent, useRef, useState, useEffect, ChangeEvent } from "react";
import { useApp } from "@/lib/store";
import { FeatureId, ResumeTab, ParsedIntent } from "@/lib/intent";
import {
  speakText,
  stopSpeaking,
  startSpeechRecognition,
  SpeechRecognitionController,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
} from "@/lib/voice";

export type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time?: string;
  attachedDocName?: string;
  intent?: ParsedIntent;
  redirecting?: boolean;
  engine?: string;
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
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timeout | null>(null);

  // Document attachment state
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [parsingDoc, setParsingDoc] = useState(false);

  // ─── Voice & Accessibility State ──────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const speechControllerRef = useRef<SpeechRecognitionController | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      speechControllerRef.current?.stop();
    };
  }, []);

  const toggleListening = () => {
    if (listening) {
      speechControllerRef.current?.stop();
      setListening(false);
      return;
    }
    setMicError(null);
    const controller = startSpeechRecognition({
      onTranscript: (transcript, isFinal) => {
        setInput((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${transcript}` : transcript;
        });
      },
      onListeningChange: (isList) => {
        setListening(isList);
      },
      onError: (err) => {
        setMicError(err);
        setListening(false);
      },
    });
    speechControllerRef.current = controller;
  };

  const toggleSpeech = (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }
    stopSpeaking();
    setSpeakingMsgId(msgId);
    speakText(text, {
      onEnd: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null),
    });
  };

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
    setAttachedFile(null);
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

  // ─── 5. Document Upload Handler ─────────────────────────────────────────────
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingDoc(true);
    const filename = file.name;
    const isText =
      file.type.includes("text") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md");

    if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = (event.target?.result as string) || "";
        setAttachedFile({ name: filename, text: textContent });
        setParsingDoc(false);
      };
      reader.readAsText(file);
    } else {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/resume/parse", { method: "POST", body: fd });
        const data = await res.json();
        setAttachedFile({
          name: filename,
          text: data.text || `Attached document: ${filename}`,
        });
      } catch {
        setAttachedFile({
          name: filename,
          text: `Attached document: ${filename}`,
        });
      } finally {
        setParsingDoc(false);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── 6. Auto Scroll & Timers ────────────────────────────────────────────────
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

  // ─── 7. Send Prompt via LLM Backend ─────────────────────────────────────────
  const runPrompt = async (prompt: string) => {
    if ((!prompt.trim() && !attachedFile) || busy || !activeConversation) return;
    setBusy(true);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `user-${Date.now()}`;
    const userMsgText = prompt.trim();
    const docInfo = attachedFile;

    // Full prompt sent to LLM including attached document text
    let fullPromptForLlm = userMsgText;
    if (docInfo) {
      fullPromptForLlm = userMsgText
        ? `${userMsgText}\n\n[Attached Document: ${docInfo.name}]\n${docInfo.text}`
        : `Please review and analyze my attached document: ${docInfo.name}\n\n${docInfo.text}`;
    }

    // Chat Title
    let chatTitle = activeConversation.title;
    if (chatTitle === "New Career Chat" || chatTitle === "New Conversation") {
      const displayTitle = userMsgText || `Review: ${docInfo?.name || "Document"}`;
      chatTitle = displayTitle.slice(0, 32) + (displayTitle.length > 32 ? "…" : "");
    }

    const nextMessages: Msg[] = [
      ...messages,
      {
        id: userMsgId,
        role: "user",
        text: userMsgText || `Uploaded document: ${docInfo?.name}`,
        attachedDocName: docInfo?.name,
        time: now,
      },
    ];

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
    setAttachedFile(null);
    scrollToBottom();

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m, idx) => ({
            role: m.role,
            text: idx === nextMessages.length - 1 ? fullPromptForLlm : m.text,
          })),
          userProfile: {
            name: user?.name,
            email: user?.email,
            targetRole: user?.targetRole || undefined,
          },
          targetRole: user?.targetRole || "frontend",
          voiceMode,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");
      const data = await res.json();

      const replyText =
        data.reply ||
        "I'm right here with you. What would you like to explore or work on today?";
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
          engine: data.engine || "CareerForge AI",
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

      // Automatically speak the response if in Voice Mode
      if (voiceMode) {
        speakText(replyText);
      }

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
          text: "I am right here with you! What would you like to chat about or explore today?",
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

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (sidebarTab === "pinned") return c.pinned && !c.archived;
    if (sidebarTab === "archived") return c.archived;
    return !c.archived;
  });

  const emptyThread = messages.length <= 1;

  return (
    <div className="flex h-[calc(100vh-4.25rem)] overflow-hidden bg-[#FDFDFB]">
      
      {/* ─── LEFT AI SIDEBAR (Vertical List of Features & Chats) ───────────── */}
      <aside
        className={`flex flex-col border-r border-neutral-200 bg-white transition-all duration-200 z-20 ${
          sidebarOpen ? "w-72 sm:w-80 shrink-0" : "w-0 -translate-x-full overflow-hidden border-none"
        }`}
      >
        {/* Top Action: New Chat */}
        <div className="p-3.5 border-b border-neutral-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              AI Assistant
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
            <span className="text-sm font-bold">+</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Vertical Navigation Sections (Modern AI Sidebar Style) */}
        <div className="p-2 space-y-1 border-b border-neutral-100">
          <button
            type="button"
            onClick={() => setSidebarTab("all")}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              sidebarTab === "all"
                ? "bg-neutral-100 text-neutral-900 font-semibold"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            }`}
          >
            <ChatBubbleIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="flex-1 text-left">All Recent Chats</span>
            <span className="text-[11px] text-neutral-400 font-mono">
              {conversations.filter((c) => !c.archived).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab("pinned")}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              sidebarTab === "pinned"
                ? "bg-neutral-100 text-neutral-900 font-semibold"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            }`}
          >
            <PinIcon filled className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="flex-1 text-left">Pinned &amp; Starred</span>
            <span className="text-[11px] text-neutral-400 font-mono">
              {conversations.filter((c) => c.pinned && !c.archived).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab("archived")}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              sidebarTab === "archived"
                ? "bg-neutral-100 text-neutral-900 font-semibold"
                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            }`}
          >
            <ArchiveIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span className="flex-1 text-left">Archived Chats</span>
            <span className="text-[11px] text-neutral-400 font-mono">
              {conversations.filter((c) => c.archived).length}
            </span>
          </button>
        </div>

        {/* Vertical Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            {sidebarTab === "pinned" ? "Pinned Discussions" : sidebarTab === "archived" ? "Archive" : "History"}
          </p>

          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-400">
              {sidebarTab === "pinned"
                ? "No pinned chats. Click the pin icon to keep important chats at top."
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
                    {conv.pinned && <PinIcon filled className="w-3 h-3 text-amber-600 shrink-0" />}
                    <span className="truncate">{conv.title}</span>
                  </div>

                  {/* Actions on Hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Pin Action */}
                    <button
                      type="button"
                      onClick={(e) => togglePin(conv.id, e)}
                      title={conv.pinned ? "Unpin chat" : "Pin chat to top"}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-amber-600 transition-colors"
                    >
                      <PinIcon filled={conv.pinned} className="w-3 h-3" />
                    </button>

                    {/* Archive Action */}
                    <button
                      type="button"
                      onClick={(e) => toggleArchive(conv.id, e)}
                      title={conv.archived ? "Unarchive chat" : "Archive chat"}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 transition-colors"
                    >
                      <ArchiveIcon className="w-3 h-3" />
                    </button>

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={(e) => deleteConversation(conv.id, e)}
                      title="Delete chat"
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-600 transition-colors"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ─── MAIN CHAT VIEW ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        
        {/* Top Chat Toolbar */}
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-xs"
              title="Toggle Sidebar"
            >
              <SidebarToggleIcon className="w-3.5 h-3.5" />
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
                <h1 className="font-display text-3xl italic text-ink md:text-4xl tracking-tight">
                  {userDisplayName ? `Hello, ${userDisplayName}` : "How can I help you today?"}
                </h1>

                <p className="mx-auto max-w-md text-xs text-graphite leading-relaxed">
                  Ask career questions, upload your resume for review, or explore guided tracks below.
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
                      {m.engine && !isUser && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.2 text-[9px] font-mono text-neutral-600 border border-neutral-200">
                          {m.engine}
                        </span>
                      )}
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => toggleSpeech(m.id, m.text)}
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer ${
                            speakingMsgId === m.id
                              ? "bg-blue-100 text-blue-800 animate-pulse border border-blue-300 shadow-2xs"
                              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                          }`}
                          title={speakingMsgId === m.id ? "Stop reading aloud" : "Click-to-Voice (Listen Aloud)"}
                        >
                          {speakingMsgId === m.id ? (
                            <>
                              <StopIcon className="w-2.5 h-2.5 text-blue-600" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <SpeakerIcon className="w-2.5 h-2.5" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      )}
                      {m.time && <span>&bull; {m.time}</span>}
                    </div>

                    <div className="space-y-2 max-w-[90%] sm:max-w-[80%]">
                      {/* Attached Document Pill (if message included a document) */}
                      {m.attachedDocName && (
                        <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700 w-fit">
                          <PaperclipIcon className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="font-medium truncate max-w-[200px]">{m.attachedDocName}</span>
                        </div>
                      )}

                      <div
                        className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                          isUser
                            ? "bg-ink text-paper rounded-tr-xs shadow-sm font-normal"
                            : "border border-neutral-200/80 bg-white text-ink rounded-tl-xs shadow-xs"
                        }`}
                      >
                        <p className="whitespace-pre-line">{m.text}</p>
                      </div>

                      {/* Interactive Workspace Action */}
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

              {/* AI Thinking / Reasoning Indicator */}
              {busy && redirectCountdown === null && (
                <div className="flex flex-col items-start animate-in fade-in">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 px-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                    </span>
                    <span>AI is thinking & reasoning…</span>
                  </div>
                  <div className="rounded-2xl rounded-tl-xs border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-blue-50/50 px-4 py-3 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" />
                      <span className="ml-2 text-xs font-medium text-neutral-500">Synthesizing response</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── MODERN AI PROMPT COMPOSER (ChatGPT / Claude Style) ─────────────── */}
        <div className="border-t border-neutral-200/80 bg-white/95 px-4 pb-6 pt-3.5 backdrop-blur-md">
          <div className="mx-auto max-w-3xl space-y-2.5">
            
            {/* Hidden Document File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md,.rtf"
              onChange={handleFileUpload}
              className="hidden"
              id="ai-doc-upload"
            />

            {/* AI Rounded-3xl Card Box */}
            <form
              onSubmit={onSubmit}
              className="relative flex flex-col rounded-2xl sm:rounded-3xl border border-neutral-300 bg-neutral-50/70 p-3 shadow-sm focus-within:border-neutral-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-neutral-900/5 transition-all"
            >
              {/* Attached Document Preview Badge */}
              {attachedFile && (
                <div className="mb-2 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800 animate-in fade-in shadow-2xs">
                  <div className="flex items-center gap-2 truncate">
                    <PaperclipIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-semibold truncate">{attachedFile.name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">(Ready for AI audit)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="rounded p-1 text-neutral-400 hover:text-red-600"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Textarea Input */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
                rows={1}
                placeholder={
                  attachedFile
                    ? `Ask anything about ${attachedFile.name}...`
                    : "Message CareerForge AI or attach a document..."
                }
                className="max-h-36 min-h-[36px] w-full resize-none bg-transparent px-1 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />

              {/* Bottom Control Bar inside Composer */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200/50 mt-1">
                {/* Left: Document Upload & Voice Dictation Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsingDoc}
                    title="Attach document (PDF, DOCX, TXT)"
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 transition-colors disabled:opacity-50"
                  >
                    {parsingDoc ? (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-neutral-500 border-t-transparent animate-spin" />
                    ) : (
                      <PaperclipIcon className="w-3.5 h-3.5 text-neutral-500" />
                    )}
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  {/* Unlimited Voice Dictation (STT) */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                      listening
                        ? "bg-red-500 text-white animate-pulse shadow-sm"
                        : "text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900"
                    }`}
                    title={listening ? "Listening... click to stop" : "Voice Dictation (Browser Web Speech API)"}
                  >
                    <MicIcon className={`w-3.5 h-3.5 ${listening ? "text-white animate-bounce" : "text-neutral-500"}`} />
                    <span>{listening ? "Listening…" : "Voice"}</span>
                  </button>

                  {micError && (
                    <span className="text-[10px] text-red-600 truncate max-w-[120px]">
                      {micError}
                    </span>
                  )}
                </div>

                {/* Right: Circular Send Button (ChatGPT style ↑) */}
                <button
                  type="submit"
                  disabled={busy || (!input.trim() && !attachedFile)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all shadow-xs ${
                    input.trim() || attachedFile
                      ? "bg-neutral-900 text-white hover:bg-black scale-100 cursor-pointer"
                      : "bg-neutral-200 text-neutral-400 cursor-not-allowed opacity-60"
                  }`}
                  title="Send prompt"
                >
                  <ArrowUpIcon className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Quick Suggested Prompt Pills */}
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

// ─── SVG Vector Icons ─────────────────────────────────────────────────────────

function PaperclipIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function PinIcon({
  filled = false,
  className = "w-3 h-3",
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.828 1.172a2 2 0 0 1 2.828 0l2.172 2.172a2 2 0 0 1 0 2.828l-1.414 1.414-2.828-2.828 1.414-1.414zM4.172 6.828l2.828 2.828-4.242 4.242a.5.5 0 0 1-.708 0l-1.414-1.414a.5.5 0 0 1 0-.708l4.242-4.242zM7 4l5 5-2 2-5-5 2-2z" />
    </svg>
  );
}

function ArchiveIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function TrashIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ChatBubbleIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SidebarToggleIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function ArrowUpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function SpeakerIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function MicIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function StopIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
