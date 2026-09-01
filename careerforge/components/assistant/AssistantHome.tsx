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
} from "@/lib/voice";
import { ShareModal } from "./ShareModal";

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

// Clean prompt pills matching Photo 3
const quickPills = [
  { label: "🗺️ Check Roadmap", prompt: "Show me my complete career roadmap" },
  { label: "📚 Top Courses", prompt: "Recommend the best free & curated courses for my role" },
  { label: "🎯 Mock Interview", prompt: "I want to practice interview questions" },
  { label: "📄 ATS Resume Audit", prompt: "Help me audit my resume for ATS compliance" },
  { label: "📍 Local Tech Jobs", prompt: "Show local and remote jobs matching my target profile" },
  { label: "💼 2026 Salary Trends", prompt: "What are the latest 2026 salary trends for my role?" },
  { label: "🧠 Behavioral (STAR)", prompt: "Help me frame my past experience using the STAR method" },
  { label: "🚀 Portfolio Projects", prompt: "Give me standout production project ideas for my portfolio" },
];

export function AssistantHome({
  onRedirect,
}: {
  onRedirect: (feature: FeatureId, tab?: ResumeTab) => void;
}) {
  const {
    user,
    setTargetRole,
    voiceMode,
    setVoiceMode,
    accessibilityPrefs,
    setAccessibilityPrefs,
    currentLocation,
    userSkills,
    missingSkills,
  } = useApp();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"all" | "pinned" | "archived">("all");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timeout | null>(null);
  const [resumeDraftState, setResumeDraftState] = useState<any>(null);

  // Document attachment state
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const [parsingDoc, setParsingDoc] = useState(false);

  // ─── Voice & Silence Detection State ───────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

  // Share & Toast State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Horizontal Scroll Carousel State
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Refs
  const speechControllerRef = useRef<SpeechRecognitionController | null>(null);
  const speechBaseTextRef = useRef<string>("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const promptScrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  const [voiceLang, setVoiceLang] = useState<string>("auto");

  // Cleanup timers & speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      speechControllerRef.current?.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (silenceCountdownIntervalRef.current) clearInterval(silenceCountdownIntervalRef.current);
    };
  }, []);

  // Update horizontal prompt scroll buttons
  const checkPromptScroll = () => {
    if (promptScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = promptScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }
  };

  useEffect(() => {
    checkPromptScroll();
    window.addEventListener("resize", checkPromptScroll);
    return () => window.removeEventListener("resize", checkPromptScroll);
  }, []);

  const scrollPrompts = (direction: "left" | "right") => {
    if (promptScrollRef.current) {
      const offset = direction === "left" ? -280 : 280;
      promptScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
      setTimeout(checkPromptScroll, 320);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // ─── Voice Recognition with 3.5s Silence Auto-Send ─────────────────────────
  const clearSilenceTimers = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (silenceCountdownIntervalRef.current) {
      clearInterval(silenceCountdownIntervalRef.current);
      silenceCountdownIntervalRef.current = null;
    }
    setSilenceCountdown(null);
  };

  const startSilenceAutoSendCountdown = () => {
    clearSilenceTimers();

    let timeLeft = 3.5;
    setSilenceCountdown(Math.ceil(timeLeft));

    silenceCountdownIntervalRef.current = setInterval(() => {
      timeLeft -= 0.5;
      if (timeLeft <= 0) {
        if (silenceCountdownIntervalRef.current) clearInterval(silenceCountdownIntervalRef.current);
      } else {
        setSilenceCountdown(Math.ceil(timeLeft));
      }
    }, 500);

    // Auto-send when 3.5s silence is reached
    silenceTimerRef.current = setTimeout(() => {
      clearSilenceTimers();
      if (speechControllerRef.current) {
        speechControllerRef.current.stop();
      }
      setListening(false);

      const textToSend = inputRef.current.trim();
      if (textToSend) {
        setInput("");
        runPrompt(textToSend);
      }
    }, 3500);
  };

  const toggleListening = () => {
    if (listening) {
      clearSilenceTimers();
      speechControllerRef.current?.stop();
      setListening(false);
      return;
    }

    setMicError(null);
    clearSilenceTimers();
    speechBaseTextRef.current = input.trim();

    const controller = startSpeechRecognition({
      lang: voiceLang,
      onTranscript: (transcript: string) => {
        if (transcript) {
          const base = speechBaseTextRef.current;
          const combined = base ? `${base} ${transcript}` : transcript;
          setInput(combined);
          inputRef.current = combined;
          startSilenceAutoSendCountdown();
        }
      },
      onListeningChange: (isList: boolean) => {
        setListening(isList);
        if (!isList) clearSilenceTimers();
      },
      onError: (err: string) => {
        setMicError(err);
        setListening(false);
        clearSilenceTimers();
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
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return {
      id: "intro-1",
      role: "assistant",
      time: now,
      text: `Hi! I'm your career assistant. I can help you build or improve your resume, find skills to learn, discover projects, and find jobs. You can talk to me or type. How would you like to continue?`,
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
    clearSilenceTimers();
  };

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

  // ─── 7. Send Prompt via Backend ─────────────────────────────────────────────
  const runPrompt = async (prompt: string) => {
    if ((!prompt.trim() && !attachedFile) || busy || !activeConversation) return;
    clearSilenceTimers();
    setBusy(true);

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsgId = `user-${Date.now()}`;
    const userMsgText = prompt.trim();
    const docInfo = attachedFile;

    let fullPromptForLlm = userMsgText;
    if (docInfo) {
      fullPromptForLlm = userMsgText
        ? `${userMsgText}\n\n[Attached Document: ${docInfo.name}]\n${docInfo.text}`
        : `Please review and analyze my attached document: ${docInfo.name}\n\n${docInfo.text}`;
    }

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
            skills: userSkills,
            missingSkills,
            location: currentLocation || undefined,
          },
          targetRole: user?.targetRole || "frontend",
          voiceMode,
          currentPage: "assistant",
          accessibilityPrefs,
          resumeDraftState,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");
      const data = await res.json();

      if (data.resumeDraftState) {
        setResumeDraftState(data.resumeDraftState);
      }

      if (data.toolCall) {
        if (data.toolCall.tool === "updateAccessibilityPreferences" && data.toolCall.parameters) {
          setAccessibilityPrefs(data.toolCall.parameters);
          if (data.toolCall.parameters.interactionMode === "voice") {
            setVoiceMode(true);
          }
        }
      }

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

      // Automatically speak the response if speech output is active
      if (voiceMode && accessibilityPrefs?.speechOutput !== false) {
        speakText(replyText);
      }

      setBusy(false);
      if (hasFeature && data.feature && (userMsgText.toLowerCase().startsWith("open") || userMsgText.toLowerCase().startsWith("take me to") || userMsgText.toLowerCase().startsWith("go to"))) {
        setRedirectCountdown(3);
        const timer = setTimeout(() => {
          executeRedirect(data.feature, data.resumeTab);
        }, 3200);
        setActiveTimer(timer);
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
    clearSilenceTimers();
    if (listening) {
      speechControllerRef.current?.stop();
      setListening(false);
    }
    const value = input;
    setInput("");
    runPrompt(value);
  };

  const filteredConversations = conversations.filter((c) => {
    if (sidebarTab === "pinned") return c.pinned && !c.archived;
    if (sidebarTab === "archived") return c.archived;
    return !c.archived;
  });

  const emptyThread = messages.length <= 1;

  return (
    <div className="flex h-[calc(100vh-4.25rem)] overflow-hidden bg-[#FDFDFB]">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-3 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Share Conversation Modal Dialog */}
      <ShareModal
        conversation={activeConversation}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onShowToast={showToast}
      />

      {/* ─── LEFT AI SIDEBAR (Vertical List of Chats) ───────────────────────── */}
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
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-2.5 px-3 text-xs font-semibold text-white shadow-xs hover:bg-black transition-all cursor-pointer"
          >
            <span className="text-sm font-bold">+</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Vertical Navigation Sections */}
        <div className="p-2 space-y-1 border-b border-neutral-100">
          <button
            type="button"
            onClick={() => setSidebarTab("all")}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
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
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
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
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
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
                    <button
                      type="button"
                      onClick={(e) => togglePin(conv.id, e)}
                      title={conv.pinned ? "Unpin chat" : "Pin chat to top"}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-amber-600 transition-colors"
                    >
                      <PinIcon filled={conv.pinned} className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => toggleArchive(conv.id, e)}
                      title={conv.archived ? "Unarchive chat" : "Archive chat"}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 transition-colors"
                    >
                      <ArchiveIcon className="w-3 h-3" />
                    </button>

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
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 shadow-xs cursor-pointer"
              title="Toggle Sidebar"
            >
              <SidebarToggleIcon className="w-3.5 h-3.5" />
              <span>{sidebarOpen ? "Hide Chats" : "Show Chats"}</span>
            </button>

            <span className="text-xs font-semibold text-neutral-800 truncate max-w-[180px] sm:max-w-md">
              {activeConversation?.title || "Career Copilot"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-xs cursor-pointer"
              title="Share conversation link or transcript"
            >
              <ShareHeaderIcon className="w-3.5 h-3.5 text-neutral-600" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={createNewConversation}
              className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              title="Start new chat"
            >
              <span>+ New</span>
            </button>
          </div>
        </div>

        {/* Scrollable Conversation Stream */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col px-4 py-8 md:py-12">
            {emptyThread && (
              <div className="mb-8 text-center space-y-4">
                <h1 className="font-display text-3xl italic text-ink md:text-4xl tracking-tight">
                  {userDisplayName ? `Hello, ${userDisplayName}` : "How can I help you today?"}
                </h1>

                <p className="mx-auto max-w-md text-xs text-graphite leading-relaxed">
                  I can help you build or improve your resume, find skills to learn, discover projects, and find jobs. You can talk to me or type.
                </p>

                {/* Primary Voice vs Text Entry Options */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceMode(true);
                      toggleListening();
                      speakText("Hi! I'm your career assistant. I can help you build or improve your resume, find skills to learn, discover projects, and find jobs. How can I help you today?");
                    }}
                    className="flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-semibold shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5"
                  >
                    <span className="text-sm">🎙️</span>
                    <span>Talk to me (Voice)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      textareaRef.current?.focus();
                    }}
                    className="flex items-center gap-2 rounded-full border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 px-5 py-2.5 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <span className="text-sm">⌨️</span>
                    <span>Type to me (Text)</span>
                  </button>
                </div>
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
                                className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-ink transition-colors cursor-pointer"
                              >
                                Stay in Chat
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => executeRedirect(m.intent!.feature!, m.intent!.resumeTab)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
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

        {/* ─── CLEAN BOTTOM PROMPT COMPOSER & PILLS MATCHING PHOTO 3 ─────────── */}
        <div className="border-t border-neutral-200/80 bg-white/95 px-4 pb-5 pt-3 backdrop-blur-md">
          <div className="mx-auto max-w-3xl space-y-3">
            
            {/* Hidden Document File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md,.rtf"
              onChange={handleFileUpload}
              className="hidden"
              id="ai-doc-upload"
            />

            {/* AI Rounded Card Box */}
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
                    className="rounded p-1 text-neutral-400 hover:text-red-600 cursor-pointer"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Textarea Input with Instant Enter Submission */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  inputRef.current = e.target.value;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
                    e.preventDefault();
                    if (input.trim() || attachedFile) {
                      const val = input;
                      setInput("");
                      inputRef.current = "";
                      runPrompt(val);
                    }
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
                {/* Left Controls: Clean Attach & Unlimited Voice */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsingDoc}
                    title="Attach document (PDF, DOCX, TXT)"
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {parsingDoc ? (
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-neutral-500 border-t-transparent animate-spin" />
                    ) : (
                      <PaperclipIcon className="w-3.5 h-3.5 text-neutral-500" />
                    )}
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  {/* Voice Dictation (Auto-detects language, auto-sends on 3-4s pause) */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                      listening
                        ? "bg-red-500 text-white animate-pulse shadow-sm"
                        : "text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900"
                    }`}
                    title={
                      listening
                        ? "Listening... will auto-send after 3-4s of silence"
                        : "Voice Dictation in any language (Auto-sends on pause)"
                    }
                  >
                    <MicIcon className={`w-3.5 h-3.5 ${listening ? "text-white animate-bounce" : "text-neutral-500"}`} />
                    <span>{listening ? (silenceCountdown ? `Auto-sending in ${silenceCountdown}s…` : "Listening…") : "Voice"}</span>
                  </button>

                  {micError && (
                    <span className="text-[10px] text-red-600 truncate max-w-[140px]">
                      {micError}
                    </span>
                  )}
                </div>

                {/* Right: Circular Send Button (↑) */}
                <button
                  type="submit"
                  disabled={busy || (!input.trim() && !attachedFile)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all shadow-xs ${
                    input.trim() || attachedFile
                      ? "bg-neutral-900 text-white hover:bg-black scale-100 cursor-pointer"
                      : "bg-neutral-200 text-neutral-400 cursor-not-allowed opacity-60"
                  }`}
                  title="Send prompt (or press Enter)"
                >
                  <ArrowUpIcon className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* ─── HORIZONTAL SCROLLABLE PROMPT CAROUSEL MATCHING PHOTO 3 ───────── */}
            <div className="relative flex items-center group/carousel">
              {/* Left Scroll Button */}
              <button
                type="button"
                onClick={() => scrollPrompts("left")}
                disabled={!canScrollLeft}
                aria-label="Scroll prompts left"
                className={`absolute left-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white/95 shadow-md backdrop-blur-xs transition-all ${
                  canScrollLeft
                    ? "opacity-100 hover:bg-neutral-100 hover:scale-105 cursor-pointer text-neutral-800"
                    : "opacity-0 pointer-events-none text-neutral-300"
                }`}
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>

              {/* Scroll Container */}
              <div
                ref={promptScrollRef}
                onScroll={checkPromptScroll}
                className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 w-full"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {quickPills.map((pill) => (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => runPrompt(pill.prompt)}
                    className="shrink-0 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 hover:bg-neutral-50 transition-all shadow-2xs cursor-pointer whitespace-nowrap active:scale-95"
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Right Scroll Button (Matching Photo 3) */}
              <button
                type="button"
                onClick={() => scrollPrompts("right")}
                disabled={!canScrollRight}
                aria-label="Scroll prompts right"
                className={`absolute right-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white/95 shadow-md backdrop-blur-xs transition-all ${
                  canScrollRight
                    ? "opacity-100 hover:bg-neutral-100 hover:scale-105 cursor-pointer text-neutral-800"
                    : "opacity-0 pointer-events-none text-neutral-300"
                }`}
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SVG Vector Icons ─────────────────────────────────────────────────────────

function ChevronLeftIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ShareHeaderIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

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
