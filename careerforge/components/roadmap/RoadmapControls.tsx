"use client";

import React, { useEffect, useRef, useState } from "react";
import { TechCategory, NodeStatus, RoadmapNode } from "@/types/roadmapTree";

interface RoadmapControlsProps {
  categories: {
    id: TechCategory;
    label: string;
    icon: string;
    accentColor: string;
  }[];
  activeCategory: TechCategory;
  onCategoryChange: (category: TechCategory) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: NodeStatus | "all";
  onStatusFilterChange: (status: NodeStatus | "all") => void;
  viewMode: "tree" | "list";
  onViewModeChange: (mode: "tree" | "list") => void;
  allNodes?: RoadmapNode[];
  onSelectNode?: (node: RoadmapNode) => void;
  onResetProgress?: () => void;
}

export const RoadmapControls: React.FC<RoadmapControlsProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  allNodes = [],
  onSelectNode,
  onResetProgress,
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Compute live search suggestions
  const searchSuggestions = React.useMemo(() => {
    if (!searchQuery.trim() || !allNodes) return [];
    const q = searchQuery.toLowerCase().trim();
    return allNodes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          (n.keyConcepts || []).some((c) => c.toLowerCase().includes(q)) ||
          (n.skills || []).some((s) => s.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [searchQuery, allNodes]);

  const handleSelectSearchResult = (node: RoadmapNode) => {
    if (onSelectNode) {
      onSelectNode(node);
    }
    // Scroll node element into view
    const elem = document.getElementById(`roadmap-node-${node.id}`);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setIsSearchFocused(false);
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Category Track Pills Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap border ${
                isSelected
                  ? "bg-accent text-white border-accent shadow-xs font-semibold"
                  : "bg-surface text-ink/75 border-ink/15 hover:bg-bg hover:text-ink"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${isSelected ? "bg-bg" : "bg-accent"}`}
              />
              <span className="font-semibold">{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Toolbar Row: Search, Status Filter & View Mode Switcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-ink/15 shadow-xs">
        {/* Search Bar with Live Results Dropdown */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink/40">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            placeholder="Search topics, skills, or tools... (Press '/' to focus)"
            className="w-full pl-8 pr-12 py-1.5 rounded-lg bg-bg border border-ink/15 text-xs text-ink placeholder:text-ink/45 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
          />

          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink/50 hover:text-ink text-xs cursor-pointer"
            >
              ✕
            </button>
          ) : (
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-ink/50 bg-surface rounded border border-ink/15">
                /
              </kbd>
            </div>
          )}

          {/* Live Search Suggestions Dropdown */}
          {isSearchFocused && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-surface border border-ink/15 shadow-xl z-50 overflow-hidden py-1 text-ink">
              <div className="px-3 py-1 text-[10px] font-mono text-ink/50 border-b border-ink/10">
                Found {searchSuggestions.length} topic{searchSuggestions.length > 1 ? "s" : ""}
              </div>
              {searchSuggestions.map((node) => (
                <div
                  key={node.id}
                  onMouseDown={() => handleSelectSearchResult(node)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-bg cursor-pointer text-left transition-colors"
                >
                  <div>
                    <span className="text-xs font-semibold text-ink">{node.title}</span>
                    <span className="block text-[10px] text-ink/60 font-mono">
                      {node.level} · ~{node.estimatedHours}h
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-accent">Inspect →</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Section: Status Filters & View Mode */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Status Filters */}
          <div className="inline-flex rounded-lg bg-bg p-1 border border-ink/15 shrink-0">
            {(
              [
                { id: "all", label: "All" },
                { id: "completed", label: "Done" },
                { id: "in-progress", label: "Active" },
                { id: "planned", label: "Planned" },
                { id: "locked", label: "Locked" },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onStatusFilterChange(st.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  statusFilter === st.id
                    ? "bg-accent text-white shadow-xs font-semibold"
                    : "text-ink/70 hover:text-ink"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Tree Graph vs Structured List */}
          <div className="inline-flex rounded-lg bg-bg p-1 border border-ink/15 shrink-0">
            <button
              type="button"
              onClick={() => onViewModeChange("tree")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === "tree"
                  ? "bg-accent text-white shadow-xs font-semibold"
                  : "text-ink/70 hover:text-ink"
              }`}
            >
              <span>Graph</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-accent text-white shadow-xs font-semibold"
                  : "text-ink/70 hover:text-ink"
              }`}
            >
              <span>List</span>
            </button>
          </div>

          {/* Optional Reset Progress Button */}
          {onResetProgress && (
            <button
              type="button"
              onClick={onResetProgress}
              title="Reset progress for this category"
              className="p-1.5 rounded-lg text-ink/50 hover:text-danger hover:bg-bg transition-colors cursor-pointer text-xs"
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
