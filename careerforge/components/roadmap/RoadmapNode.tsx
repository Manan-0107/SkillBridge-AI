"use client";

import React from "react";
import { RoadmapNode as RoadmapNodeType } from "@/types/roadmap";
import { Badge } from "@/components/shared/Badge";

interface RoadmapNodeProps {
  node: RoadmapNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  isAncestor: boolean;
  isChild: boolean;
  isDimmed: boolean;
  isSearchMatch: boolean;
  tabIndex: number;
  onClick: (node: RoadmapNodeType) => void;
  onKeyDown?: (e: React.KeyboardEvent, node: RoadmapNodeType) => void;
}

export const RoadmapNode = React.memo(function RoadmapNode({
  node,
  x,
  y,
  width,
  height,
  isSelected,
  isAncestor,
  isChild,
  isDimmed,
  isSearchMatch,
  tabIndex,
  onClick,
  onKeyDown,
}: RoadmapNodeProps) {
  // Border and background state based on selection tiers
  let borderClasses = "border-hairline";
  let bgClasses = "bg-charcoal-850 hover:bg-charcoal-800";
  let opacityClasses = "opacity-100";
  let scaleClasses = "hover:scale-[1.02]";
  let shadowClasses = "";

  if (isSelected) {
    borderClasses = "border-accent-400 ring-2 ring-accent-500/30";
    bgClasses = "bg-charcoal-800";
    shadowClasses = "shadow-glow";
  } else if (isAncestor) {
    borderClasses = "border-accent-500/60";
    bgClasses = "bg-charcoal-800/90";
  } else if (isChild) {
    borderClasses = "border-accent-400/40";
  } else if (isDimmed) {
    opacityClasses = "opacity-35";
    scaleClasses = "";
  }

  if (isSearchMatch) {
    borderClasses += " ring-2 ring-amber-300";
  }

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={isSelected}
      aria-label={`${node.title}, depth ${node.depth}, status ${node.status}`}
      tabIndex={tabIndex}
      onClick={() => onClick(node)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(node);
        } else if (onKeyDown) {
          onKeyDown(e, node);
        }
      }}
      className={`group cursor-pointer rounded-node border p-3 flex flex-col justify-between select-none transition-all duration-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-950 ${borderClasses} ${bgClasses} ${opacityClasses} ${scaleClasses} ${shadowClasses}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-charcoal-100 leading-snug line-clamp-1 group-hover:text-white transition-colors">
          {node.title}
        </h3>
        <Badge status={node.status} showIcon={true} />
      </div>

      <div className="flex items-center justify-between text-xs text-charcoal-400 font-mono mt-1">
        <span className="text-[11px] uppercase tracking-wider text-charcoal-500">
          Depth {node.depth}
        </span>
        <span className="text-[11px] text-charcoal-400">
          {node.concepts.length} {node.concepts.length === 1 ? "concept" : "concepts"}
        </span>
      </div>
    </div>
  );
});
