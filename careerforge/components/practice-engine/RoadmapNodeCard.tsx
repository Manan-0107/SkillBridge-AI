"use client";

import React, { memo } from "react";
import { StaticRoadmapNode, NodeStatus } from "@/types/practiceEngine";

interface RoadmapNodeCardProps {
  node: StaticRoadmapNode;
  effectiveStatus: NodeStatus;
  checklistCompletedCount: number;
  isSelected: boolean;
  isAncestor: boolean;
  isChild: boolean;
  onSelect: (node: StaticRoadmapNode) => void;
  accentColor?: string;
}

const statusBadgeConfig: Record<
  NodeStatus,
  { label: string; badgeClass: string; dotClass: string; icon: string }
> = {
  completed: {
    label: "Done",
    badgeClass: "bg-emerald-950/50 border-emerald-700/60 text-emerald-300",
    dotClass: "bg-emerald-400",
    icon: "✓",
  },
  "in-progress": {
    label: "In Progress",
    badgeClass: "bg-amber-950/50 border-amber-700/60 text-amber-300",
    dotClass: "bg-amber-400 animate-pulse",
    icon: "⚡",
  },
  planned: {
    label: "Planned",
    badgeClass: "bg-slate-900/80 border-slate-800 text-slate-400",
    dotClass: "bg-slate-600",
    icon: "○",
  },
};

export const RoadmapNodeCard = memo<RoadmapNodeCardProps>(function RoadmapNodeCard({
  node,
  effectiveStatus,
  checklistCompletedCount,
  isSelected,
  isAncestor,
  isChild,
  onSelect,
  accentColor = "#F59E0B",
}) {
  const currentBadge = statusBadgeConfig[effectiveStatus] || statusBadgeConfig.planned;
  const totalChecklist = node.checklist.length;
  const percentChecklist =
    totalChecklist > 0 ? Math.round((checklistCompletedCount / totalChecklist) * 100) : 0;

  // Highlight style evaluation
  let cardClass = "border-slate-800/90 hover:border-slate-700 bg-[#121520]";
  let transformEffect = "hover:-translate-y-0.5 transition-all duration-150";

  if (isSelected) {
    cardClass = "border-amber-400 bg-[#161a28] ring-1 ring-amber-400/40 shadow-lg";
    transformEffect = "-translate-y-0.5";
  } else if (isAncestor) {
    cardClass = "border-amber-500/60 bg-[#131622] ring-1 ring-amber-500/20";
  } else if (isChild) {
    cardClass = "border-indigo-500/60 bg-[#131622] ring-1 ring-indigo-500/20";
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(node)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(node);
        }
      }}
      aria-label={`Inspect ${node.title}, status: ${currentBadge.label}`}
      className={`relative w-full rounded-xl border p-4 text-left cursor-pointer select-none outline-none ${cardClass} ${transformEffect}`}
    >
      {/* Header Badges */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {node.badge && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono"
              style={{
                borderColor: `${accentColor}50`,
                backgroundColor: `${accentColor}10`,
                color: accentColor,
              }}
            >
              {node.badge}
            </span>
          )}
          {isAncestor && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60">
              ↑ Prereq
            </span>
          )}
          {isChild && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
              ↓ Next Step
            </span>
          )}
        </div>

        {/* Status indicator badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${currentBadge.badgeClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${currentBadge.dotClass}`} />
          <span>{currentBadge.label}</span>
        </span>
      </div>

      {/* Title & Summary */}
      <h3 className="font-semibold text-slate-100 text-sm sm:text-base leading-snug">
        {node.title}
      </h3>
      <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
        {node.description}
      </p>

      {/* Key Concepts Chips */}
      {node.keyConcepts.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {node.keyConcepts.slice(0, 3).map((concept) => (
            <span
              key={concept}
              className="inline-flex items-center rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-700/40"
            >
              {concept}
            </span>
          ))}
          {node.keyConcepts.length > 3 && (
            <span className="text-[10px] text-slate-500 font-mono px-1">
              +{node.keyConcepts.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer Progress & Estimated Hours */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        {totalChecklist > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${percentChecklist}%`,
                  backgroundColor:
                    percentChecklist === 100
                      ? "#10B981"
                      : percentChecklist > 0
                      ? "#F59E0B"
                      : "#475569",
                }}
              />
            </div>
            <span>
              {checklistCompletedCount}/{totalChecklist} done
            </span>
          </div>
        ) : (
          <span className="text-slate-500 text-[10px]">Essential Standard</span>
        )}

        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <span>~{node.estimatedHours}h</span>
        </div>
      </div>
    </div>
  );
});
