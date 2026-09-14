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
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-charcoal-950/85 backdrop-blur-xl text-charcoal-200 transition-colors">
      <div className="app-shell relative flex items-center justify-between py-3">
        {/* Left: Brand Logo with glowing gem icon */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onAssistant}
            className="group flex items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-charcoal-950 font-black text-xs tracking-tighter shadow-md shadow-amber-500/25 group-hover:scale-105 transition-transform">
              CF
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xl font-bold tracking-tight text-charcoal-100 group-hover:text-amber-400 transition-colors">
                CareerForge
              </span>
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-amber-400">
                AI
              </span>
            </div>
          </button>
        </div>

        {/* Center: Sleek Segmented Pill Navigation Container */}
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
          <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-charcoal-900/90 p-1 shadow-inner shadow-black/40 backdrop-blur-md">
            <button
              type="button"
              onClick={onAssistant}
              aria-current={view === "assistant" ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                view === "assistant"
                  ? "bg-charcoal-800 text-charcoal-100 shadow-sm border border-white/[0.12] text-amber-400"
                  : "text-charcoal-400 hover:text-charcoal-200 hover:bg-white/[0.04]"
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
                    ? "bg-charcoal-800 text-charcoal-100 shadow-sm border border-white/[0.12] text-amber-400"
                    : "text-charcoal-400 hover:text-charcoal-200 hover:bg-white/[0.04]"
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
                className="h-8 w-8 rounded-full border border-white/10 ring-2 ring-amber-500/20 object-cover"
              />
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-charcoal-950" />
            </div>
          ) : (
            <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-charcoal-800 text-xs font-bold text-charcoal-200 border border-white/10 sm:flex">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}
          <span className="hidden text-xs font-medium text-charcoal-300 sm:inline">
            {user?.name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-white/[0.08] bg-charcoal-900/60 px-2.5 py-1 text-xs font-medium text-charcoal-400 hover:border-red-500/30 hover:bg-red-950/20 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="flex items-center justify-center gap-2 overflow-x-auto border-t border-white/[0.08] px-4 py-2 md:hidden bg-charcoal-950">
        <button
          type="button"
          onClick={onAssistant}
          aria-current={view === "assistant" ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            view === "assistant" ? "bg-charcoal-800 text-amber-400 font-semibold border border-white/10" : "text-charcoal-400"
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
              view === l.id ? "bg-charcoal-800 text-amber-400 font-semibold border border-white/10" : "text-charcoal-400"
            }`}
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
