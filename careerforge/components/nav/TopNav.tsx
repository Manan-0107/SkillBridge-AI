"use client";

import { useApp } from "@/lib/store";

const links = [
  { id: "resume", label: "Resume" },
  { id: "roadmap", label: "Roadmap" },
  { id: "courses", label: "Courses" },
  { id: "practice", label: "Practice" },
  { id: "local", label: "Local" },
];

export function TopNav() {
  const { user, signOut } = useApp();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center justify-between px-6 py-4">
        <span className="font-display text-lg italic text-ink">CareerForge</span>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="text-[13px] font-medium text-graphite transition-colors hover:text-ink"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <span className="hidden text-[13px] text-graphite sm:inline">
            {user?.name}
          </span>
          <button
            onClick={signOut}
            className="text-[13px] font-medium text-graphite underline decoration-line underline-offset-4 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>

      <nav className="flex gap-5 overflow-x-auto border-t border-line px-6 py-2.5 md:hidden">
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => scrollTo(l.id)}
            className="whitespace-nowrap text-[13px] font-medium text-graphite hover:text-ink"
          >
            {l.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
