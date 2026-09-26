"use client";

import React, { ReactNode } from "react";

interface UbixGlowBorderProps {
  children: ReactNode;
  active?: boolean;
  className?: string;
  rounded?: string;
}

/**
 * UbixGlowBorder
 * 
 * Reusable wrapper that provides a subtle soft silver & tiny icy cyan reflection border
 * for focused inputs, active navigation, or hero cards.
 */
export function UbixGlowBorder({
  children,
  active = false,
  className = "",
  rounded = "rounded-2xl",
}: UbixGlowBorderProps) {
  return (
    <div
      className={`relative ${rounded} transition-all duration-300 ${
        active ? "ubix-glow-border-active" : "ubix-glow-border-idle"
      } ${className}`}
    >
      {children}
    </div>
  );
}
