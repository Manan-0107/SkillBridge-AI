"use client";

import React, { useEffect, useRef } from "react";

/**
 * UbixAmbientBackground
 * 
 * Fixed full-viewport background layer providing:
 * 1. Base dark graphite surface
 * 2. Multi-layered center-weighted metallic reflections (brushed studio illumination)
 * 3. Desktop cursor-reactive metallic shift with subtle icy cyan highlight
 * 
 * Performance:
 * - pointer-events: none (zero interaction interference)
 * - requestAnimationFrame for 60fps tracking
 * - Direct style mutation via CSS custom properties (zero React state / re-renders)
 * - Disabled on touch/mobile (pointer: coarse) and prefers-reduced-motion
 */
export function UbixAmbientBackground() {
  const cursorLayerRef = useRef<HTMLDivElement>(null);
  const targetPosRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Disable cursor tracking for coarse pointers (touch/mobile) or reduced-motion
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isCoarse || prefersReducedMotion) {
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      targetPosRef.current.x = e.clientX;
      targetPosRef.current.y = e.clientY;
    };

    const animate = () => {
      const target = targetPosRef.current;
      const current = currentPosRef.current;

      // Smooth metallic reflection follow without layout reads
      const dx = target.x - current.x;
      const dy = target.y - current.y;

      current.x += dx * 0.15;
      current.y += dy * 0.15;

      if (cursorLayerRef.current) {
        cursorLayerRef.current.style.setProperty("--ubix-pointer-x", `${current.x.toFixed(1)}px`);
        cursorLayerRef.current.style.setProperty("--ubix-pointer-y", `${current.y.toFixed(1)}px`);
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div
      className="ubix-ambient-background-layer fixed inset-0 pointer-events-none select-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* Layer 1: Base Dark Graphite Canvas */}
      <div className="ubix-base-canvas absolute inset-0" />

      {/* Layer 2: Center Metallic Reflection (Brushed Studio Lighting) */}
      <div className="ubix-metallic-ambient-sheen absolute inset-0" />

      {/* Layer 3: Desktop Cursor-Reactive Metallic Reflection */}
      <div
        ref={cursorLayerRef}
        className="ubix-cursor-reflection absolute inset-0 hidden md:block"
      />
    </div>
  );
}
