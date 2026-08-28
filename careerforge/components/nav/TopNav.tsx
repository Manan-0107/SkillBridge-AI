"use client";

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

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="app-shell flex items-center justify-between py-4">
        <button
          type="button"
          onClick={onAssistant}
          className="font-display text-lg italic text-ink"
        >
          CareerForge
        </button>

        <nav className="hidden items-center gap-6 md:flex">
          <button
            type="button"
            onClick={onAssistant}
            className={`text-[13px] font-medium transition-colors ${
              view === "assistant" ? "text-ink" : "text-graphite hover:text-ink"
            }`}
          >
            Assistant
          </button>
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onFeature(l.id)}
              className={`text-[13px] font-medium transition-colors ${
                view === l.id ? "text-ink" : "text-graphite hover:text-ink"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user?.picture ? (
            <img
              src={user.picture}
              alt=""
              referrerPolicy="no-referrer"
              className="hidden h-7 w-7 rounded-full sm:block"
            />
          ) : null}
          <span className="hidden text-[13px] text-graphite sm:inline">
            {user?.name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="text-[13px] font-medium text-graphite underline decoration-line underline-offset-4 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>

      <nav className="flex gap-5 overflow-x-auto border-t border-line px-6 py-2.5 md:hidden">
        <button
          type="button"
          onClick={onAssistant}
          className="whitespace-nowrap text-[13px] font-medium text-graphite hover:text-ink"
        >
          Assistant
        </button>
        {links.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onFeature(l.id)}
            className="whitespace-nowrap text-[13px] font-medium text-graphite hover:text-ink"
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
