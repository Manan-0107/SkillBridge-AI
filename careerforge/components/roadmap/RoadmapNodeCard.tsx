"use client";

import React, { memo } from "react";
import { RoadmapNode, NodeStatus } from "@/types/roadmapTree";

interface RoadmapNodeCardProps {
  node: RoadmapNode;
  status: NodeStatus;
  checklistStates?: Record<string, boolean>;
  isLocked?: boolean;
  missingPrereqs?: string[];
  isSelected?: boolean;
  isAncestor?: boolean;
  isChild?: boolean;
  onSelect: (node: RoadmapNode) => void;
  onQuickToggleStatus?: (nodeId: string, e: React.MouseEvent) => void;
  accentColor?: string;
  isCompact?: boolean;
}

const statusBadgeConfig: Record<
  NodeStatus,
  { label: string; badgeClass: string; dotClass: string; icon: string }
> = {
  completed: {
    label: "Completed",
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
  locked: {
    label: "Locked",
    badgeClass: "bg-slate-900/60 border-slate-800/80 text-slate-500",
    dotClass: "bg-slate-700",
    icon: "🔒",
  },
};

export const RoadmapNodeCard = memo<RoadmapNodeCardProps>(function RoadmapNodeCard({
  node,
  status,
  checklistStates = {},
  isLocked = false,
  missingPrereqs = [],
  isSelected = false,
  isAncestor = false,
  isChild = false,
  onSelect,
  onQuickToggleStatus,
  accentColor = "#F59E0B",
  isCompact = false,
}) {
  const effectiveStatus: NodeStatus = isLocked ? "locked" : status;
  const currentBadge = statusBadgeConfig[effectiveStatus] || statusBadgeConfig.planned;

  const totalChecklist = node.checklist.length;
  const completedCount = node.checklist.filter(
    (item) => checklistStates[item.id] ?? item.completed
  ).length;
  const percentChecklist =
    totalChecklist > 0 ? Math.round((completedCount / totalChecklist) * 100) : 0;

  // Visual container styling based on state & relations
  let cardClass = "border-slate-800/90 hover:border-slate-700 bg-[#121520]";
  let transformEffect = "hover:-translate-y-0.5 transition-all duration-150";

  if (effectiveStatus === "locked") {
    cardClass = "border-slate-800/60 bg-[#0d1017]/80 opacity-75 hover:opacity-100";
  } else if (isSelected) {
    cardClass = "border-amber-400 bg-[#161a28] ring-1 ring-amber-400/40 shadow-lg";
    transformEffect = "-translate-y-0.5";
  } else if (isAncestor) {
    cardClass = "border-amber-500/60 bg-[#131622] ring-1 ring-amber-500/20";
  } else if (isChild) {
    cardClass = "border-indigo-500/60 bg-[#131622] ring-1 ring-indigo-500/20";
  } else if (effectiveStatus === "in-progress") {
    cardClass = "border-amber-600/70 bg-[#141724] ring-1 ring-amber-500/20";
  } else if (effectiveStatus === "completed") {
    cardClass = "border-emerald-800/60 bg-[#0f141f]";
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
      className={`relative w-full rounded-xl border ${
        isCompact ? "p-3" : "p-4"
      } text-left cursor-pointer select-none outline-none ${cardClass} ${transformEffect}`}
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
          {node.importance === "essential" && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950/40 text-rose-300 border border-rose-800/50">
              Core
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

        {/* Status indicator badge (clickable quick toggle if provided) */}
        <button
          type="button"
          disabled={isLocked}
          onClick={(e) => {
            if (onQuickToggleStatus && !isLocked) {
              e.stopPropagation();
              onQuickToggleStatus(node.id, e);
            }
          }}
          title={
            isLocked
              ? `Locked: Requires completing prerequisites: ${missingPrereqs.join(", ")}`
              : `Status: ${currentBadge.label}. Click to advance.`
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all ${currentBadge.badgeClass} ${
            !isLocked ? "hover:brightness-125" : "cursor-not-allowed"
          }`}
        >
          <span className="text-[10px]">{currentBadge.icon}</span>
          <span>{currentBadge.label}</span>
        </button>
      </div>

      {/* Title & Summary */}
      <h3 className="font-semibold text-slate-100 text-sm sm:text-base leading-snug">
        {node.title}
      </h3>
      <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
        {node.summary || node.description}
      </p>

      {/* Missing Prerequisites Notice if locked */}
      {isLocked && missingPrereqs.length > 0 && (
        <div className="mt-2 text-[10px] font-mono text-amber-400/90 bg-amber-950/20 border border-amber-800/30 rounded px-2 py-1">
          🔒 Prerequisite required to unlock
        </div>
      )}

      {/* Key Concepts Chips */}
      {node.keyConcepts && node.keyConcepts.length > 0 && !isCompact && (
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
              {completedCount}/{totalChecklist} done
            </span>
          </div>
        ) : (
          <span className="text-slate-500 text-[10px] capitalize">
            {node.level} topic
          </span>
        )}

        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <span>~{node.estimatedHours}h</span>
        </div>
      </div>
    </div>
  );
});
