"use client";

import { useVoice } from "@/context/VoiceContext";

/** Persistent floating voice-control widget, mounted once in the root layout. */
export function VoiceBar() {
  const {
    isSupported,
    isActive,
    isListening,
    transcript,
    lastCommand,
    startListening,
    stopListening,
  } = useVoice();

  if (!isSupported) return null;

  // Three states, driven by the real recognizer: idle → ready (session
  // requested, warming up / between restarts) → listening (capturing audio).
  const status = isListening ? "Listening" : isActive ? "Voice ready" : "Voice idle";
  const dot = isListening
    ? "animate-pulse bg-red-600"
    : isActive
    ? "animate-pulse bg-amber-500"
    : "bg-zinc-300";

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,22rem)] border border-black bg-white shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center justify-between border-b border-black px-4 py-2">
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`}
          />
          {status}
        </span>
        <button
          type="button"
          aria-pressed={isActive}
          onClick={isActive ? stopListening : startListening}
          className="rounded-none border border-black px-3 py-1 text-xs font-black uppercase tracking-widest hover:bg-zinc-900 hover:text-white"
        >
          {isActive ? "Stop" : "Start"}
        </button>
      </div>

      <div className="px-4 py-3">
        <p
          aria-live="polite"
          className="min-h-[2.5rem] text-sm leading-snug text-zinc-900"
        >
          {transcript || (
            <span className="text-zinc-400">
              Say “go to resume”, “analyze”, “open roadmap”, “practice”…
            </span>
          )}
        </p>
        {lastCommand && (
          <p className="mt-2 text-xs font-black uppercase tracking-widest text-zinc-500">
            → {lastCommand}
          </p>
        )}
      </div>
    </div>
  );
}
