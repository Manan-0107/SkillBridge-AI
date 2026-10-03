import React from "react";
import { RoadmapNode } from "@/types/roadmap";

interface BadgeProps {
  status: RoadmapNode["status"];
  className?: string;
  showIcon?: boolean;
}

export const Badge = React.memo(function Badge({
  status,
  className = "",
  showIcon = true,
}: BadgeProps) {
  if (status === "completed") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-status-completed-bg text-status-completed border border-status-completed-border ${className}`}
        aria-label="Status: Completed"
      >
        {showIcon && (
          <svg
            className="w-3 h-3 text-status-completed"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
          </svg>
        )}
        <span>Completed</span>
      </span>
    );
  }

  if (status === "in-progress") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-status-in-progress-bg text-status-in-progress border border-status-in-progress-border ${className}`}
        aria-label="Status: In Progress"
      >
        {showIcon && (
          <svg
            className="w-3 h-3 text-status-in-progress"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="5" strokeDasharray="16" strokeDashoffset="5" />
          </svg>
        )}
        <span>In Progress</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-status-planned-bg text-status-planned border border-status-planned-border ${className}`}
      aria-label="Status: Planned"
    >
      {showIcon && (
        <svg
          className="w-3 h-3 text-status-planned"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeDasharray="2 2"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="5" />
        </svg>
      )}
      <span>Planned</span>
    </span>
  );
});
