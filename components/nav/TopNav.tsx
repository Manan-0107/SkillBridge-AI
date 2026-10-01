"use client";

import { useApp } from "@/lib/store";
import { FeatureId } from "@/lib/intent";

const links: { id: FeatureId; label: string }[] = [
  { id: "resume",   label: "Resume" },
  { id: "roadmap",  label: "Roadmap" },
  { id: "courses",  label: "Courses" },
  { id: "practice", label: "Practice" },
  { id: "local",    label: "Local" },
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
    <header
      className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-xl"
      style={{ backdropFilter: "blur(24px)" }}
    >
      <div className="app-shell flex items-center justify-between py-3.5">
        {/* Logo */}
        <button
          type="button"
          onClick={onAssistant}
          className="group flex items-center gap-2.5 focus-visible:outline-none"
        >
          {/* Accent dot */}
          <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(34,211,238,0.6)] group-hover:shadow-[0_0_14px_rgba(34,211,238,0.9)] transition-shadow" />
          <span className="font-display text-xl font-medium italic text-ink tracking-tight">
            CareerForge
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex" role="navigation">
          <NavItem
            active={view === "assistant"}
            onClick={onAssistant}
            label="Assistant"
          />
          {links.map((l) => (
            <NavItem
              key={l.id}
              active={view === l.id}
              onClick={() => onFeature(l.id)}
              label={l.label}
            />
          ))}
        </nav>

        {/* User Section */}
        <div className="flex items-center gap-3">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name ?? ""}
              referrerPolicy="no-referrer"
              className="hidden h-7 w-7 rounded-full ring-1 ring-accent/30 sm:block"
            />
          ) : (
            <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-surface border border-line text-xs font-semibold text-graphite sm:flex">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          )}
          <span className="hidden text-sm text-graphite sm:inline max-w-[120px] truncate">
            {user?.name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-line bg-mist px-3 py-1.5 text-xs font-medium text-graphite transition-colors hover:border-accent/40 hover:text-accent"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile Nav Strip */}
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 no-scrollbar md:hidden" role="navigation">
        <MobileNavItem active={view === "assistant"} onClick={onAssistant} label="Assistant" />
        {links.map((l) => (
          <MobileNavItem
            key={l.id}
            active={view === l.id}
            onClick={() => onFeature(l.id)}
            label={l.label}
          />
        ))}
      </nav>
    </header>
  );
}

function NavItem({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
        active
          ? "bg-accentGlow text-accent"
          : "text-graphite hover:bg-mist hover:text-ink"
      }`}
    >
      {label}
      {active && (
        <span className="absolute inset-x-3 bottom-1 h-px rounded-full bg-accent opacity-60" />
      )}
    </button>
  );
}

function MobileNavItem({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-accentGlow text-accent"
          : "text-graphite hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
