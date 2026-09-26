"use client";

import React from "react";

interface UbixGlowBorderProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}

export function UbixGlowBorder({
  children,
  className = "",
  active = false,
}: UbixGlowBorderProps) {
  return (
    <div
      className={`ubix-glow-border rounded-2xl ${active ? "ring-1 ring-accent/30" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
