"use client";

import React from "react";

export type OrbState = "idle" | "listening" | "thinking" | "processing" | "success" | "error";

interface UbixThinkingOrbProps {
  state?: OrbState;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * UbixThinkingOrb
 * 
 * Assistant status indicator reacting to current cognitive state.
 * States:
 * - IDLE: soft metallic silver
 * - LISTENING: subtle icy cyan glow
 * - THINKING: silver + subtle cyan orbital motion
 * - PROCESSING: slower restrained metallic movement
 * - SUCCESS: brief silver/cyan highlight
 * - ERROR: restrained red
 * 
 * Includes ARIA live description and text equivalent.
 */
export function UbixThinkingOrb({
  state = "idle",
  size = "md",
  className = "",
}: UbixThinkingOrbProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-9 h-9",
  }[size];

  const stateLabels: Record<OrbState, string> = {
    idle: "Assistant is ready",
    listening: "Assistant is listening to your voice",
    thinking: "Assistant is thinking",
    processing: "Assistant is processing request",
    success: "Action completed successfully",
    error: "An issue occurred",
  };

  return (
    <div
      role="status"
      aria-label={stateLabels[state]}
      className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}
    >
      <span className="sr-only">{stateLabels[state]}</span>

      {/* Outer ambient glow shell */}
      <div
        className={`ubix-orb-glow ubix-orb-glow-${state} absolute inset-0 rounded-full transition-all duration-300 pointer-events-none`}
      />

      {/* Core metallic orb sphere */}
      <div
        className={`ubix-orb-core ubix-orb-core-${state} relative w-full h-full rounded-full transition-all duration-300`}
      >
        {/* Subtle metallic reflection highlight */}
        <div className="ubix-orb-highlight absolute inset-0.5 rounded-full pointer-events-none" />
      </div>
    </div>
  );
}
