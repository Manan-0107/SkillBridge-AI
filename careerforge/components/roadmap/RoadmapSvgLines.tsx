"use client";

import React from "react";
import { NodeStatus } from "@/types/roadmapTree";

interface MilestoneCheckpointProps {
  stageNumber: number;
  title: string;
  subtitle?: string;
  status?: "completed" | "current" | "upcoming";
  accentColor?: string;
}

export const MilestoneCheckpoint: React.FC<MilestoneCheckpointProps> = ({
  stageNumber,
  title,
  subtitle,
  status = "upcoming",
  accentColor = "#F59E0B",
}) => {
  const isCompleted = status === "completed";
  const isCurrent = status === "current";

  return (
    <div className="relative flex items-center justify-center my-8 z-10">
      {/* Background Horizontal Line */}
      <div className="absolute inset-0 flex items-center pointer-events-none">
        <div
          className={`w-full border-t transition-colors duration-300 ${
            isCompleted
              ? "border-emerald-800/60"
              : isCurrent
              ? "border-amber-700/60"
              : "border-slate-800/80"
          }`}
        />
      </div>

      {/* Central Checkpoint Badge */}
      <div className="relative flex flex-col items-center bg-[#0d1017] px-4">
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-md transition-all duration-300 ${
            isCompleted
              ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-300"
              : isCurrent
              ? "bg-amber-950/40 border-amber-500/80 text-amber-300 ring-1 ring-amber-400/30"
              : "bg-[#131724] border-slate-700/80 text-slate-300"
          }`}
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest">
            {isCompleted ? "✓ CHECKPOINT" : isCurrent ? "⚡ CURRENT STAGE" : "STAGE"}{" "}
            0{stageNumber}
          </span>
          <span className="text-slate-600">·</span>
          <h3 className="font-semibold text-xs uppercase tracking-wider text-white">
            {title}
          </h3>
        </div>

        {subtitle && (
          <span className="text-[11px] text-slate-400 mt-1 max-w-sm text-center">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

interface BranchConnectorProps {
  side: "left" | "right";
  isOptional?: boolean;
  status?: NodeStatus;
  isHighlighted?: boolean;
  accentColor?: string;
}

export const BranchSvgConnector: React.FC<BranchConnectorProps> = ({
  side,
  isOptional = false,
  status = "planned",
  isHighlighted = false,
  accentColor = "#F59E0B",
}) => {
  const isCompleted = status === "completed";

  let strokeColor = "#334155";
  if (isHighlighted) {
    strokeColor = accentColor;
  } else if (isCompleted) {
    strokeColor = "#10B981";
  }

  return (
    <div
      className={`hidden lg:flex items-center w-8 shrink-0 ${
        side === "left" ? "justify-end" : "justify-start"
      }`}
    >
      <svg
        width="32"
        height="16"
        viewBox="0 0 32 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <path
          d={side === "left" ? "M32 8 H0" : "M0 8 H32"}
          stroke={strokeColor}
          strokeWidth={isHighlighted || isCompleted ? "2" : "1.5"}
          strokeDasharray={isOptional ? "3 3" : undefined}
        />
        {/* Terminal Junction Dot */}
        <circle
          cx={side === "left" ? 4 : 28}
          cy="8"
          r={isHighlighted ? "3" : "2.5"}
          fill={strokeColor}
        />
      </svg>
    </div>
  );
};

export const VerticalTrunkConnector: React.FC<{
  isCompleted?: boolean;
  isHighlighted?: boolean;
  accentColor?: string;
}> = ({ isCompleted, isHighlighted, accentColor = "#F59E0B" }) => {
  const stroke = isHighlighted ? accentColor : isCompleted ? "#10B981" : "#334155";

  return (
    <div className="flex justify-center items-center my-3">
      <svg width="12" height="32" viewBox="0 0 12 32" fill="none">
        <line
          x1="6"
          y1="0"
          x2="6"
          y2="24"
          stroke={stroke}
          strokeWidth="1.5"
        />
        <polygon
          points="2,24 10,24 6,30"
          fill={stroke}
        />
      </svg>
    </div>
  );
};
