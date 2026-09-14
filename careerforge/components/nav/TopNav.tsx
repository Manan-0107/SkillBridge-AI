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
    <header className="sticky top-0 z-40 border-b border-hairline bg-charcoal-950/90 backdrop-blur text-charcoal-200">
      <div className="app-shell relative flex items-center justify-between py-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onAssistant}
            className="font-display text-xl italic text-charcoal-100 hover:text-accent-400 transition-colors"
          >
            CareerForge
          </button>
        </div>

        {/* Center: Navigation Links in the exact middle with accessible keyboard navigation */}
        <nav
          aria-label="Primary navigation"
          className="absolute left-1/2 -translate-x-1/2 hidden items-center gap-7 md:flex"
          onKeyDown={(e) => {
            const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
            const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (currentIndex !== -1) {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                const next = (currentIndex + 1) % buttons.length;
                buttons[next].focus();
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                const prev = (currentIndex - 1 + buttons.length) % buttons.length;
                buttons[prev].focus();
              }
            }
          }}
        >
          <button
            type="button"
            onClick={onAssistant}
            aria-current={view === "assistant" ? "page" : undefined}
            className={`text-sm font-medium transition-colors rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              view === "assistant" ? "text-charcoal-100 font-semibold border-b-2 border-accent-500" : "text-charcoal-400 hover:text-charcoal-200"
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
              className={`text-sm font-medium transition-colors rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                view === l.id ? "text-charcoal-100 font-semibold border-b-2 border-accent-500" : "text-charcoal-400 hover:text-charcoal-200"
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
              className="hidden h-7 w-7 rounded-full sm:block border border-hairline"
            />
          ) : null}
          <span className="hidden text-sm text-charcoal-300 sm:inline">
            {user?.name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="text-sm font-medium text-charcoal-400 underline decoration-hairline underline-offset-4 hover:text-charcoal-100"
          >
            Sign out
          </button>
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="flex items-center justify-center gap-6 overflow-x-auto border-t border-hairline px-6 py-2.5 md:hidden">
        <button
          type="button"
          onClick={onAssistant}
          aria-current={view === "assistant" ? "page" : undefined}
          className={`whitespace-nowrap text-sm font-medium ${
            view === "assistant" ? "text-charcoal-100 font-semibold" : "text-charcoal-400 hover:text-charcoal-200"
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
            className={`whitespace-nowrap text-sm font-medium ${
              view === l.id ? "text-charcoal-100 font-semibold" : "text-charcoal-400 hover:text-charcoal-200"
            }`}
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
