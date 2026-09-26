"use client";

import React from "react";

export type UbixOrbState = "idle" | "listening" | "thinking" | "processing" | "success" | "error";

interface UbixThinkingOrbProps {
  state?: UbixOrbState;
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

const STATE_META: Record<
  UbixOrbState,
  {
    label: string;
    containerClass: string;
    pointFill: string;
    centerFill: string;
    ringClass: string;
  }
> = {
  idle: {
    label: "Idle",
    containerClass: "text-ink/40",
    pointFill: "currentColor",
    centerFill: "currentColor",
    ringClass: "opacity-20",
  },
  listening: {
    label: "Listening",
    containerClass: "text-accent ubix-orb-listening",
    pointFill: "currentColor",
    centerFill: "currentColor",
    ringClass: "opacity-40 animate-pulse",
  },
  thinking: {
    label: "Thinking",
    containerClass: "text-ink/85 ubix-constellation-spin",
    pointFill: "currentColor",
    centerFill: "text-accent",
    ringClass: "opacity-30",
  },
  processing: {
    label: "Processing",
    containerClass: "text-ink/70 ubix-constellation-slow",
    pointFill: "currentColor",
    centerFill: "text-accent",
    ringClass: "opacity-25",
  },
  success: {
    label: "Completed",
    containerClass: "text-accent ubix-orb-success",
    pointFill: "currentColor",
    centerFill: "currentColor",
    ringClass: "opacity-60",
  },
  error: {
    label: "Attention needed",
    containerClass: "text-danger",
    pointFill: "currentColor",
    centerFill: "currentColor",
    ringClass: "opacity-30",
  },
};

const SIZE_MAP = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

export function UbixThinkingOrb({
  state = "idle",
  size = "md",
  className = "",
  showText = false,
}: UbixThinkingOrbProps) {
  const meta = STATE_META[state] || STATE_META.idle;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      role="status"
      aria-label={`System status: ${meta.label}`}
      className={`inline-flex items-center gap-2 select-none shrink-0 ${className}`}
    >
      <div className={`relative flex items-center justify-center ${sizeClass}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`h-full w-full ${meta.containerClass} transition-colors duration-300`}
          aria-hidden="true"
        >
          {/* Extremely thin orbital guide ring */}
          <circle
            cx="12"
            cy="12"
            r="7.5"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="1.5 2.5"
            className={meta.ringClass}
          />

          {/* Center core point */}
          <circle
            cx="12"
            cy="12"
            r="1.2"
            fill="currentColor"
            className={meta.centerFill}
          />

          {/* 6 Constellation orbital points */}
          <circle cx="19.5" cy="12" r="1" fill={meta.pointFill} className="ubix-constellation-point" />
          <circle cx="15.75" cy="18.5" r="1" fill={meta.pointFill} className="ubix-constellation-point" />
          <circle cx="8.25" cy="18.5" r="1" fill={meta.pointFill} className="ubix-constellation-point" />
          <circle cx="4.5" cy="12" r="1" fill={meta.pointFill} className="ubix-constellation-point" />
          <circle cx="8.25" cy="5.5" r="1" fill={meta.pointFill} className="ubix-constellation-point" />
          <circle cx="15.75" cy="5.5" r="1" fill={meta.pointFill} className="ubix-constellation-point" />
        </svg>
      </div>

      {showText && (
        <span className="text-xs font-medium text-ink/70">
          {meta.label}
        </span>
      )}
      {!showText && (
        <span className="sr-only">{meta.label}</span>
      )}
    </div>
  );
}
