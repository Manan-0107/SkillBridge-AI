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
    badgeClass: "bg-success/15 border-success/30 text-success",
    dotClass: "bg-success",
    icon: "✓",
  },
  "in-progress": {
    label: "In Progress",
    badgeClass: "bg-accent/15 border-accent/30 text-accent",
    dotClass: "bg-accent animate-pulse",
    icon: "•",
  },
  planned: {
    label: "Planned",
    badgeClass: "bg-surface border-ink/15 text-ink/70",
    dotClass: "bg-ink/40",
    icon: "○",
  },
  locked: {
    label: "Locked",
    badgeClass: "bg-ink/5 border-ink/10 text-ink/40",
    dotClass: "bg-ink/20",
    icon: "—",
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
  accentColor = "var(--color-accent)",
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
  let cardClass = "border-ink/15 hover:border-ink/30 bg-surface text-ink shadow-xs";
  let transformEffect = "hover:-translate-y-0.5 transition-all duration-150";

  if (effectiveStatus === "locked") {
    cardClass = "border-ink/10 bg-surface/50 opacity-70 hover:opacity-100 text-ink/60";
  } else if (isSelected) {
    cardClass = "border-accent bg-surface ring-2 ring-accent/30 shadow-md text-ink";
    transformEffect = "-translate-y-0.5";
  } else if (isAncestor) {
    cardClass = "border-accent/40 bg-surface ring-1 ring-accent/20 text-ink";
  } else if (isChild) {
    cardClass = "border-info/40 bg-surface ring-1 ring-info/20 text-ink";
  } else if (effectiveStatus === "in-progress") {
    cardClass = "border-accent/40 bg-surface text-ink ring-1 ring-accent/20";
  } else if (effectiveStatus === "completed") {
    cardClass = "border-success/40 bg-surface text-ink";
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
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono border-accent/25 bg-accent/10 text-accent"
            >
              {node.badge}
            </span>
          )}
          {node.importance === "essential" && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-danger/10 text-danger border border-danger/25">
              Core
            </span>
          )}
          {isAncestor && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-accent/10 text-accent border border-accent/25">
              ↑ Prereq
            </span>
          )}
          {isChild && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-info/10 text-info border border-info/25">
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
            !isLocked ? "hover:brightness-95 cursor-pointer" : "cursor-not-allowed"
          }`}
        >
          <span className="text-[10px]">{currentBadge.icon}</span>
          <span>{currentBadge.label}</span>
        </button>
      </div>

      {/* Title & Summary */}
      <h3 className="font-semibold text-ink text-sm sm:text-base leading-snug">
        {node.title}
      </h3>
      <p className="mt-1 text-xs text-ink/70 line-clamp-2 leading-relaxed">
        {node.summary || node.description}
      </p>

      {/* Missing Prerequisites Notice if locked */}
      {isLocked && missingPrereqs.length > 0 && (
        <div className="mt-2 text-[10px] font-mono text-accent bg-accent/10 border border-accent/25 rounded px-2 py-1">
          Prerequisite required to unlock
        </div>
      )}

      {/* Key Concepts Chips */}
      {node.keyConcepts && node.keyConcepts.length > 0 && !isCompact && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {node.keyConcepts.slice(0, 3).map((concept) => (
            <span
              key={concept}
              className="inline-flex items-center rounded bg-bg px-1.5 py-0.5 text-[10px] font-mono text-ink/80 border border-ink/15"
            >
              {concept}
            </span>
          ))}
          {node.keyConcepts.length > 3 && (
            <span className="text-[10px] text-ink/50 font-mono px-1">
              +{node.keyConcepts.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer Progress & Estimated Hours */}
      <div className="mt-3.5 pt-2.5 border-t border-ink/10 flex items-center justify-between text-[11px] text-ink/65 font-mono">
        {totalChecklist > 0 ? (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 rounded-full bg-ink/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${percentChecklist}%`,
                  backgroundColor:
                    percentChecklist === 100
                      ? "var(--color-success)"
                      : percentChecklist > 0
                      ? "var(--color-accent)"
                      : "rgba(20, 17, 15, 0.25)",
                }}
              />
            </div>
            <span>
              {completedCount}/{totalChecklist} done
            </span>
          </div>
        ) : (
          <span className="text-ink/60 text-[10px] capitalize">
            {node.level} topic
          </span>
        )}

        <div className="flex items-center gap-1 text-ink/60 text-[11px]">
          <span>~{node.estimatedHours}h</span>
        </div>
      </div>
    </div>
  );
});
