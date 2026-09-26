"use client";

import React from "react";
import { Mic } from "lucide-react";

interface UbixVoiceIndicatorProps {
  listening: boolean;
  busy?: boolean;
  label?: string;
  className?: string;
}

/**
 * UbixVoiceIndicator
 * 
 * Integrated voice status indicator providing accessible ARIA status
 * and subtle icy-cyan illumination when active.
 */
export function UbixVoiceIndicator({
  listening,
  busy = false,
  label,
  className = "",
}: UbixVoiceIndicatorProps) {
  const statusText = listening
    ? "Listening..."
    : busy
    ? "Processing voice..."
    : "Voice idle";

  return (
    <div
      role="status"
      aria-label={label || statusText}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs transition-all ${
        listening
          ? "ubix-voice-btn-listening"
          : busy
          ? "ubix-voice-btn-busy"
          : "ubix-voice-btn-idle"
      } ${className}`}
    >
      <span className="sr-only">{statusText}</span>
      <Mic
        size={14}
        className={listening ? "ubix-voice-icon-active animate-pulse" : "ubix-voice-icon-idle"}
      />
      <span>{label || (listening ? "Listening" : busy ? "Thinking" : "Voice")}</span>
    </div>
  );
}
