"use client";

import React, { useEffect, useRef } from "react";

export function UbixCursorGlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetPosRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Disable on coarse pointer devices (touch/mobile) or prefers-reduced-motion
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

      // Smooth interpolation without layout-triggering reads
      const dx = target.x - current.x;
      const dy = target.y - current.y;

      current.x += dx * 0.18;
      current.y += dy * 0.18;

      if (containerRef.current) {
        containerRef.current.style.setProperty("--cursor-x", `${current.x.toFixed(1)}px`);
        containerRef.current.style.setProperty("--cursor-y", `${current.y.toFixed(1)}px`);
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
      ref={containerRef}
      className="ubix-cursor-glow-layer pointer-events-none"
      aria-hidden="true"
    />
  );
}
