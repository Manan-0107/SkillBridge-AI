"use client";

import React, { useEffect, useState } from "react";
import { VoiceSessionManager } from "@/lib/voice/VoiceSessionManager";
import { VoiceInteractionContext, VoiceHealthMetrics } from "@/lib/voice/voiceProtocol";

export function VoiceDiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<VoiceInteractionContext | null>(null);
  const [metrics, setMetrics] = useState<VoiceHealthMetrics | null>(null);

  useEffect(() => {
    const manager = VoiceSessionManager.getInstance();
    const unsubscribe = manager.subscribe((currCtx, currMetrics) => {
      setContext(currCtx);
      setMetrics(currMetrics);
    });

    // Keyboard shortcut to toggle HUD: Ctrl+Shift+D
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      unsubscribe();
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (process.env.NODE_ENV === "production" && !open) {
    return null;
  }

  return (
    <aside
      aria-label="Voice Diagnostics HUD"
      className="fixed bottom-3 right-3 z-50 font-mono text-[11px] select-none"
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Open Voice Diagnostics HUD (Ctrl+Shift+D)"
          aria-label="Open Voice Diagnostics HUD"
          className="flex items-center gap-1.5 rounded-full bg-slate-900/90 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 shadow-xl backdrop-blur-md hover:bg-slate-800 transition-all cursor-pointer"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              metrics?.micState === "ACTIVE"
                ? metrics?.vadState === "SPEECH"
                  ? "bg-emerald-400 animate-ping"
                  : "bg-emerald-500"
                : "bg-amber-400"
            }`}
          />
          <span className="font-semibold tracking-wider uppercase text-[10px]">Voice HUD</span>
          {metrics && (
            <span className="text-[10px] text-slate-400">
              {metrics.vadState} · {metrics.currentDbLevel}dB
            </span>
          )}
        </button>
      ) : (
        <div className="w-80 rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 text-slate-200 shadow-2xl backdrop-blur-lg animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-100">
                Voice Pipeline HUD
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white text-xs px-1 rounded hover:bg-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="mt-2.5 space-y-2">
            {/* Hardware & Stream Status */}
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-900/80 p-2 border border-slate-800/80">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Microphone</span>
                <span
                  className={`font-semibold ${
                    metrics?.micState === "ACTIVE"
                      ? "text-emerald-400"
                      : metrics?.micState === "REQUESTING"
                      ? "text-amber-300"
                      : "text-rose-400"
                  }`}
                >
                  {metrics?.micState || "UNINITIALIZED"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">AudioContext</span>
                <span
                  className={`font-semibold ${
                    metrics?.audioContextState === "running" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {metrics?.audioContextState || "closed"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">VAD Status</span>
                <span
                  className={`font-semibold ${
                    metrics?.vadState === "SPEECH" ? "text-emerald-300" : "text-slate-400"
                  }`}
                >
                  {metrics?.vadState || "SILENCE"} ({metrics?.currentDbLevel ?? -60} dB)
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">WebSocket Hub</span>
                <span
                  className={`font-semibold ${
                    metrics?.wsState === "CONNECTED"
                      ? "text-emerald-400"
                      : metrics?.wsState === "CONNECTING"
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {metrics?.wsState || "DISCONNECTED"}
                </span>
              </div>
            </div>

            {/* Current Interaction State */}
            <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-400">Interaction Status</span>
                <span
                  className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    context?.status === "USER_SPEAKING"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : context?.status === "LISTENING"
                      ? "bg-blue-500/20 text-blue-300"
                      : context?.status === "ASKING"
                      ? "bg-amber-500/20 text-amber-300"
                      : context?.status === "COMMITTED"
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {context?.status || "IDLE"}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                ID: <span className="text-slate-200">{context?.interactionId || "None"}</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Target:{" "}
                <span className="text-slate-200">
                  {context?.questionId ? `Q: ${context.questionId}` : ""}{" "}
                  {context?.fieldId ? `Field: ${context.fieldId}` : ""}
                </span>
              </div>
            </div>

            {/* Live Transcripts */}
            <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase text-slate-400 block">Live Transcripts</span>
              <div className="text-[11px] text-amber-300/90 truncate min-h-[16px]">
                {metrics?.lastInterimText ? `[Interim] ${metrics.lastInterimText}` : "—"}
              </div>
              <div className="text-[11px] text-emerald-300 truncate min-h-[16px]">
                {metrics?.lastFinalText ? `[Final] ${metrics.lastFinalText}` : "—"}
              </div>
            </div>

            {/* Rejection Counters & Performance */}
            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1">
              <div>Seq Packets: #{metrics?.currentSequence ?? 0}</div>
              <div>Rate: {metrics?.audioFramesPerSec ?? 0} fps</div>
              <div>Stale Rejections: {metrics?.rejectionsCount.staleInteraction ?? 0}</div>
              <div>Echo Suppressed: {metrics?.rejectionsCount.echoSuppressed ?? 0}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
