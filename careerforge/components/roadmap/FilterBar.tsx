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
      <div className="flex items-center gap-1 bg-charcoal-900 border border-hairline p-1 rounded-xl">
        {TRACK_OPTIONS.map((t) => {
          const isActive = currentTrack.toLowerCase() === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTrackChange(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-charcoal-800 text-charcoal-100 font-semibold border border-hairline shadow-xs"
                  : "text-charcoal-400 hover:text-charcoal-200"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Status Filter Toggles */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
        <span className="text-xs font-mono text-charcoal-500 mr-1 hidden sm:inline">
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all ${
                isSelected
                  ? "bg-charcoal-800 text-charcoal-100 border-charcoal-600 shadow-xs"
                  : "bg-charcoal-900/60 text-charcoal-500 border-hairline-subtle opacity-75 hover:opacity-100"
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
