"use client";

import React, { useState, useEffect } from "react";

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  matchCount?: number;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  matchCount,
  className = "",
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(value);

  // ~150ms debounce as per spec Section 5
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(internalValue);
    }, 150);

    return () => clearTimeout(timer);
  }, [internalValue, onChange]);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute left-3.5 text-ink/40 pointer-events-none">
        <svg
          className="w-4 h-4"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="M13.5 13.5L18 18" />
        </svg>
      </div>

      <input
        type="search"
        role="searchbox"
        aria-label="Search roadmap nodes and concepts"
        placeholder="Filter nodes (e.g. React, Event Loop, CSS Grid)..."
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        className="w-full h-10 pl-10 pr-20 rounded-xl bg-bg border border-ink/15 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
      />

      {internalValue && (
        <div className="absolute right-3 flex items-center gap-2">
          {matchCount !== undefined && (
            <span className="text-[11px] font-mono text-ink/60 bg-surface px-1.5 py-0.5 rounded border border-ink/10">
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setInternalValue("");
              onChange("");
            }}
            aria-label="Clear search query"
            className="text-ink/40 hover:text-ink transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
