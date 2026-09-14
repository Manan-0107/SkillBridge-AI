"use client";

import React, { useEffect } from "react";
import { TrackId, NodeStatus, PracticeStreakStats } from "@/types/practiceEngine";

interface EngineControlsProps {
  activeTrack: TrackId;
  onTrackChange: (track: TrackId) => void;
  activeTab: "roadmap" | "daily-practice";
  onTabChange: (tab: "roadmap" | "daily-practice") => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: NodeStatus | "all";
  onStatusFilterChange: (st: NodeStatus | "all") => void;
  streakStats: PracticeStreakStats;
}

const TRACKS_CONFIG: {
  id: TrackId;
  label: string;
  badge: string;
  accent: string;
}[] = [
  { id: "frontend", label: "Frontend", badge: "Web", accent: "#F59E0B" },
  { id: "backend", label: "Backend", badge: "API & DB", accent: "#6366F1" },
  { id: "mobile", label: "Mobile", badge: "iOS & Android", accent: "#10B981" },
  { id: "fullstack", label: "Fullstack", badge: "Architecture", accent: "#EC4899" },
];

export const EngineControls: React.FC<EngineControlsProps> = ({
  activeTrack,
  onTrackChange,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  streakStats,
}) => {
  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        const searchInput = document.getElementById("roadmap-search-input");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="space-y-4 mb-7">
      {/* Top Banner: Mode Switcher & Streak Banner */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-3 sm:p-4 rounded-xl bg-[#11141f]/90 border border-slate-800/80 shadow-sm backdrop-blur-md">
        {/* Navigation Tabs (Roadmap Tree vs Daily Practice) */}
        <div className="inline-flex rounded-lg bg-[#0c0e15] p-1 border border-slate-800 self-start">
          <button
            type="button"
            onClick={() => onTabChange("roadmap")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "roadmap"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Branching Roadmap</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("daily-practice")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "daily-practice"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Daily Practice (10 Drills)</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/80">
              Active
            </span>
          </button>
        </div>

        {/* CDN Info & Streak Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs font-medium">
            <span>🔥</span>
            <span>{streakStats.currentStreak} Day Streak</span>
            <span className="text-[10px] text-amber-400/70 font-mono">({streakStats.totalCompletedDays} completed)</span>
          </div>
        </div>
      </div>

      {/* Track Tabs Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TRACKS_CONFIG.map((t) => {
          const isSelected = activeTrack === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTrackChange(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap border ${
                isSelected
                  ? "bg-[#141824] text-white border-slate-700 shadow-sm"
                  : "bg-[#0d1017]/70 text-slate-400 border-slate-800/80 hover:bg-[#121520] hover:text-slate-200"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: t.accent }}
              />
              <span className="font-semibold">{t.label}</span>
              <span className="text-[10px] text-slate-500 font-mono">[{t.badge}]</span>
            </button>
          );
        })}
      </div>

      {/* Search & Status Filters (active when viewing Roadmap) */}
      {activeTab === "roadmap" && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Search Bar with Keybinding */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="roadmap-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search concepts, tools, or nodes... (Press '/' to focus)"
              className="w-full pl-8 pr-12 py-1.5 rounded-lg bg-[#11141f] border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            ) : (
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-800/80 rounded border border-slate-700">
                  /
                </kbd>
              </div>
            )}
          </div>

          {/* Status Filters */}
          <div className="inline-flex rounded-lg bg-[#0c0e15] p-1 border border-slate-800 shrink-0">
            {(
              [
                { id: "all", label: "All Nodes" },
                { id: "completed", label: "Completed" },
                { id: "in-progress", label: "In Progress" },
                { id: "planned", label: "Planned" },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onStatusFilterChange(st.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  statusFilter === st.id
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

