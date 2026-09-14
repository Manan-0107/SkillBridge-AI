"use client";

import { useApp } from "@/lib/store";
import { FeatureId } from "@/lib/intent";
import { GoogleTranslateWidget } from "@/components/translation/GoogleTranslateWidget";

const links: { id: FeatureId; label: string }[] = [
  { id: "resume", label: "Resume" },
  { id: "roadmap", label: "Roadmap" },
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

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="app-shell relative flex items-center justify-between py-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onAssistant}
            className="font-display text-xl italic text-ink"
          >
            CareerForge
          </button>
        </div>

        {/* Center: Navigation Links in the exact middle */}
        <nav aria-label="Primary navigation" className="absolute left-1/2 -translate-x-1/2 hidden items-center gap-7 md:flex">
          <button
            type="button"
            onClick={onAssistant}
            aria-current={view === "assistant" ? "page" : undefined}
            className={`text-sm font-medium transition-colors ${
              view === "assistant" ? "text-ink font-semibold" : "text-graphite hover:text-ink"
            }`}
          >
            Assistant
          </button>
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onFeature(l.id)}
              aria-current={view === l.id ? "page" : undefined}
              className={`text-sm font-medium transition-colors ${
                view === l.id ? "text-ink font-semibold" : "text-graphite hover:text-ink"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        {/* Right: Translate & Profile */}
        <div className="flex items-center gap-3">
          <GoogleTranslateWidget />
          {user?.picture ? (
            <img
              src={user.picture}
              alt=""
              referrerPolicy="no-referrer"
              className="hidden h-7 w-7 rounded-full sm:block"
            />
          ) : null}
          <span className="hidden text-sm text-graphite sm:inline">
            {user?.name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="text-sm font-medium text-graphite underline decoration-line underline-offset-4 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="flex items-center justify-center gap-6 overflow-x-auto border-t border-line px-6 py-2.5 md:hidden">
        <button
          type="button"
          onClick={onAssistant}
          aria-current={view === "assistant" ? "page" : undefined}
          className="whitespace-nowrap text-sm font-medium text-graphite hover:text-ink"
        >
          Assistant
        </button>
        {links.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onFeature(l.id)}
            aria-current={view === l.id ? "page" : undefined}
            className="whitespace-nowrap text-sm font-medium text-graphite hover:text-ink"
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
