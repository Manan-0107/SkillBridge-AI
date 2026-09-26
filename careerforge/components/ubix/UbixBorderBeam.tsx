"use client";

import React from "react";

interface UbixBorderBeamProps {
  className?: string;
  duration?: number;
  active?: boolean;
}

export function UbixBorderBeam({
  className = "",
  duration = 8,
  active = true,
}: UbixBorderBeamProps) {
  if (!active) return null;

  return (
    <div
      className={`ubix-border-beam pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div
        className="ubix-border-beam-ray"
        style={{ animationDuration: `${duration}s` }}
      />
    </div>
  );
}
