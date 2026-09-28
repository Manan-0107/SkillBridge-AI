"use client";

import React, { ReactNode } from "react";

interface UbixMetallicSurfaceProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

/**
 * UbixMetallicSurface
 * 
 * Reusable dark metallic container surface with soft titanium border
 * and subtle center studio reflection highlight.
 */
export function UbixMetallicSurface({
  children,
  className = "",
  glow = false,
}: UbixMetallicSurfaceProps) {
  return (
    <div
      className={`ubix-metallic-surface relative rounded-2xl border transition-all duration-200 ${
        glow ? "ubix-metallic-glow" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
