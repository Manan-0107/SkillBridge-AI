"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RoadmapNode } from "@/types/roadmap";

export type StatusFilter = RoadmapNode["status"];

interface FilterBarProps {
  currentTrack: string;
  selectedStatuses: StatusFilter[];
  onStatusToggle: (status: StatusFilter) => void;
  className?: string;
}

const ALL_STATUSES: { id: StatusFilter; label: string; dotClass: string }[] = [
  { id: "completed", label: "Completed", dotClass: "bg-status-completed" },
  { id: "in-progress", label: "In Progress", dotClass: "bg-status-in-progress" },
  { id: "planned", label: "Planned", dotClass: "bg-status-planned" },
];

const TRACK_OPTIONS = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "mobile", label: "Mobile" },
  { id: "fullstack", label: "Fullstack" },
];

export function FilterBar({
  currentTrack,
  selectedStatuses,
  onStatusToggle,
  className = "",
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTrackChange = (newTrack: string) => {
    // Preserve any existing search params
    const params = new URLSearchParams(searchParams.toString());
    router.push(`/roadmap/${newTrack}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      {/* Track Selector Tabs */}
      <div className="flex items-center gap-1 bg-surface/50 border border-ink/10 p-1 rounded-xl">
        {TRACK_OPTIONS.map((t) => {
          const isActive = currentTrack.toLowerCase() === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTrackChange(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-bg text-ink font-semibold border border-ink/12 shadow-xs"
                  : "text-ink/60 hover:text-ink hover:bg-bg/50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Status Filter Toggles */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
        <span className="text-xs font-mono text-ink/50 mr-1 hidden sm:inline">
          Filter:
        </span>
        {ALL_STATUSES.map((statusItem) => {
          const isSelected = selectedStatuses.includes(statusItem.id);
          return (
            <button
              key={statusItem.id}
              type="button"
              onClick={() => onStatusToggle(statusItem.id)}
              aria-pressed={isSelected}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                isSelected
                  ? "bg-bg text-ink border-ink/20 shadow-xs font-semibold"
                  : "bg-surface/40 text-ink/50 border-ink/8 hover:text-ink hover:bg-surface"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusItem.dotClass}`} />
              <span>{statusItem.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
