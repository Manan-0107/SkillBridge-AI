"use client";

import React from "react";

export type UbixOrbState = "idle" | "listening" | "thinking" | "processing" | "success" | "error";

interface UbixThinkingOrbProps {
  state?: UbixOrbState;
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

const STATE_CONFIG: Record<
  UbixOrbState,
  {
    label: string;
    outerClass: string;
    coreClass: string;
    animClass: string;
    haloClass: string;
  }
> = {
  idle: {
    label: "Idle",
    outerClass: "border-ink/15 bg-surface",
    coreClass: "bg-ink/35",
    animClass: "",
    haloClass: "bg-ink/10",
  },
  listening: {
    label: "Listening",
    outerClass: "border-accent/40 bg-accent/10",
    coreClass: "bg-accent shadow-xs",
    animClass: "ubix-orb-listening",
    haloClass: "bg-accent/25",
  },
  thinking: {
    label: "Thinking",
    outerClass: "border-accent/30 bg-surface",
    coreClass: "bg-ink/75",
    animClass: "ubix-orb-thinking",
    haloClass: "bg-accent/20",
  },
  processing: {
    label: "Processing",
    outerClass: "border-ink/20 bg-surface",
    coreClass: "bg-ink/60",
    animClass: "ubix-orb-processing",
    haloClass: "bg-accent/15",
  },
  success: {
    label: "Completed",
    outerClass: "border-accent/60 bg-accent/20",
    coreClass: "bg-accent shadow-sm",
    animClass: "ubix-orb-success",
    haloClass: "bg-accent/40",
  },
  error: {
    label: "Error",
    outerClass: "border-danger/40 bg-danger/10",
    coreClass: "bg-danger",
    animClass: "",
    haloClass: "bg-danger/20",
  },
};

const SIZE_CONFIG = {
  sm: {
    container: "h-3.5 w-3.5",
    halo: "h-3.5 w-3.5",
    core: "h-1.5 w-1.5",
  },
  md: {
    container: "h-5 w-5",
    halo: "h-5 w-5",
    core: "h-2 w-2",
  },
  lg: {
    container: "h-8 w-8",
    halo: "h-8 w-8",
    core: "h-3 w-3",
  },
};

export function UbixThinkingOrb({
  state = "idle",
  size = "md",
  className = "",
  showText = false,
}: UbixThinkingOrbProps) {
  const conf = STATE_CONFIG[state] || STATE_CONFIG.idle;
  const sz = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  return (
    <div
      role="status"
      aria-label={`System status: ${conf.label}`}
      className={`inline-flex items-center gap-2 select-none ${className}`}
    >
      <div className={`relative flex items-center justify-center ${sz.container}`}>
        {/* Outer Halo */}
        <div
          className={`absolute rounded-full transition-all duration-300 ${sz.halo} ${conf.outerClass} ${conf.animClass}`}
          aria-hidden="true"
        />

        {/* Ambient Halo Glow */}
        <div
          className={`absolute rounded-full transition-all duration-300 blur-xs ${sz.halo} ${conf.haloClass}`}
          aria-hidden="true"
        />

        {/* Dense Center Core */}
        <div
          className={`relative rounded-full transition-colors duration-200 ${sz.core} ${conf.coreClass}`}
          aria-hidden="true"
        />
      </div>

      {/* Screen-reader text fallback */}
      <span className={showText ? "text-xs font-medium text-ink/70" : "sr-only"}>
        {conf.label}
      </span>
    </div>
  );
}
