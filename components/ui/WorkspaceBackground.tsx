"use client";

import React from "react";

/**
 * WorkspaceBackground
 *
 * Provides a quiet, architectural dark canvas inspired by Linear and Raycast:
 * 1. Deep obsidian foundation (bg token)
 * 2. Subtle top horizon cyan ambient glow (gives depth without distraction)
 * 3. Microscopic 28px dot-matrix grid with a smooth radial vignette mask
 * 4. Pure CSS hardware-accelerated rendering (0% CPU/GPU overhead)
 */
export function WorkspaceBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* 1. Base dark obsidian surface */}
      <div className="absolute inset-0 bg-bg" />

      {/* 2. Top Horizon Glow (Soft Cyan Ambient) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] opacity-70 blur-[100px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(34, 211, 238, 0.12), transparent 75%)",
        }}
      />

      {/* 3. Subtle secondary ambient violet/slate accent in bottom corner */}
      <div
        className="absolute bottom-[-150px] right-[-100px] w-[600px] h-[500px] opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.06), transparent 70%)",
        }}
      />

      {/* 4. Architectural Dot-Matrix Grid with Radial Vignette */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 85%)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 20%, transparent 85%)",
        }}
      />
    </div>
  );
}
