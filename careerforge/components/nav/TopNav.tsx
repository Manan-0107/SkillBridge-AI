"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { FeatureId } from "@/lib/intent";

const links: { id: FeatureId; label: string }[] = [
  { id: "resume", label: "Resume" },
  { id: "roadmap", label: "Roadmap" },
  { id: "courses", label: "Courses" },
  { id: "practice", label: "Practice" },
  { id: "local", label: "Local" },
];

export function TopNav({
  view,
  onAssistant,
  onFeature,
}: {
  view: "assistant" | FeatureId;
  onAssistant: () => void;
  onFeature: (id: FeatureId) => void;
}) {
  const { user, signOut } = useApp();
  const [fontScale, setFontScale] = useState<"standard" | "large" | "xlarge">("standard");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("careerforge.fontScale");
      if (saved === "large" || saved === "xlarge" || saved === "standard") {
        setFontScale(saved);
        applyScale(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const applyScale = (scale: "standard" | "large" | "xlarge") => {
    const root = document.documentElement;
    root.classList.remove("font-scale-lg", "font-scale-xl");
    if (scale === "large") root.classList.add("font-scale-lg");
    if (scale === "xlarge") root.classList.add("font-scale-xl");
  };

  const handleScaleChange = (scale: "standard" | "large" | "xlarge") => {
    setFontScale(scale);
    applyScale(scale);
    try {
      localStorage.setItem("careerforge.fontScale", scale);
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="app-shell flex items-center justify-between py-4">
        {/* Brand Logo */}
        <button
          type="button"
          onClick={onAssistant}
          className="font-display text-2xl font-bold italic tracking-tight text-ink transition-opacity hover:opacity-85"
        >
          CareerForge
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          <button
            type="button"
            onClick={onAssistant}
            className={`text-base font-semibold transition-colors ${
              view === "assistant"
                ? "text-ink border-b-2 border-ink pb-0.5"
                : "text-graphite hover:text-ink"
            }`}
          >
            Assistant
          </button>
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onFeature(l.id)}
              className={`text-base font-semibold transition-colors ${
                view === l.id
                  ? "text-ink border-b-2 border-ink pb-0.5"
                  : "text-graphite hover:text-ink"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* Right Tools: Accessibility Text Size + User Profile */}
        <div className="flex items-center gap-4">
          
          {/* Accessibility Font Size Toggle */}
          <div
            className="flex items-center rounded-lg border border-line bg-white/80 p-1 shadow-sm"
            title="Accessibility: Adjust text size"
            aria-label="Adjust font size"
          >
            <span className="px-2 text-xs font-bold text-neutral-500 uppercase tracking-wider hidden sm:inline">
              Text:
            </span>
            <button
              type="button"
              onClick={() => handleScaleChange("standard")}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-colors ${
                fontScale === "standard"
                  ? "bg-ink text-paper"
                  : "text-graphite hover:text-ink"
              }`}
              title="Standard Big Font (18px base)"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => handleScaleChange("large")}
              className={`rounded px-2.5 py-1 text-sm font-bold transition-colors ${
                fontScale === "large"
                  ? "bg-ink text-paper"
                  : "text-graphite hover:text-ink"
              }`}
              title="Large Font (20px base)"
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => handleScaleChange("xlarge")}
              className={`rounded px-2.5 py-1 text-base font-bold transition-colors ${
                fontScale === "xlarge"
                  ? "bg-ink text-paper"
                  : "text-graphite hover:text-ink"
              }`}
              title="Extra Large Font (22px base)"
            >
              A++
            </button>
          </div>

          {/* User Section */}
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="hidden h-9 w-9 rounded-full border border-neutral-300 sm:block"
              />
            ) : null}
            <span className="hidden text-base font-semibold text-graphite sm:inline">
              {user?.name}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="text-sm font-semibold text-graphite underline decoration-line underline-offset-4 hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="flex gap-6 overflow-x-auto border-t border-line px-6 py-3 md:hidden">
        <button
          type="button"
          onClick={onAssistant}
          className="whitespace-nowrap text-base font-semibold text-graphite hover:text-ink"
        >
          Assistant
        </button>
        {links.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onFeature(l.id)}
            className="whitespace-nowrap text-base font-semibold text-graphite hover:text-ink"
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
