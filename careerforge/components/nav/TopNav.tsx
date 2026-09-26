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
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-surface/90 backdrop-blur-xl text-ink transition-colors">
      <div className="app-shell relative flex items-center justify-between py-3">
        {/* Left: Brand Logo */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onAssistant}
            className="group flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-bg font-black text-xs tracking-tighter shadow-md shadow-accent/20 group-hover:scale-105 transition-transform">
              CF
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-sans text-xl font-bold tracking-tight text-ink group-hover:text-accent transition-colors">
                CareerForge
              </span>
              <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-accent">
                AI
              </span>
            </div>
          </button>
        </div>

        {/* Center: Segmented Pill Navigation Container */}
        <nav
          aria-label="Primary navigation"
          className="absolute left-1/2 -translate-x-1/2 hidden items-center md:flex"
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
          <div className="flex items-center gap-1 rounded-full border border-ink/15 bg-bg/90 p-1 shadow-inner backdrop-blur-md">
            <button
              type="button"
              onClick={onAssistant}
              aria-current={view === "assistant" ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                view === "assistant"
                  ? "bg-surface text-accent shadow-sm border border-accent/25 font-bold"
                  : "text-ink/75 hover:text-ink hover:bg-surface/60"
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
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  view === l.id
                    ? "bg-surface text-accent shadow-sm border border-accent/25 font-bold"
                    : "text-ink/75 hover:text-ink hover:bg-surface/60"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Right: Translate & Profile */}
        <div className="flex items-center gap-3">
          <GoogleTranslateWidget />
          {user?.picture ? (
            <div className="relative hidden sm:block">
              <img
                src={user.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full border border-ink/15 ring-2 ring-accent/20 object-cover"
              />
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success ring-2 ring-surface" />
            </div>
          ) : (
            <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-bold text-ink border border-ink/15 sm:flex">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}
          <span className="hidden text-xs font-medium text-ink/80 sm:inline">
            {user?.name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-ink/15 bg-surface/80 px-2.5 py-1 text-xs font-medium text-ink/80 hover:border-danger/40 hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="flex items-center justify-center gap-2 overflow-x-auto border-t border-ink/10 px-4 py-2 md:hidden bg-surface">
        <button
          type="button"
          onClick={onAssistant}
          aria-current={view === "assistant" ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            view === "assistant" ? "bg-bg text-accent font-bold border border-accent/25" : "text-ink/70"
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
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              view === l.id ? "bg-bg text-accent font-bold border border-accent/25" : "text-ink/70"
            }`}
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
