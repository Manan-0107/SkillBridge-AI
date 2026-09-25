"use client";

import React, { useMemo } from "react";
import { RoadmapTier, RoadmapNode, NodeStatus } from "@/types/roadmapTree";
import { checkNodeLocked } from "@/lib/roadmap/roadmapData";

interface RoadmapListViewProps {
  tiers: RoadmapTier[];
  allNodes: RoadmapNode[];
  selectedNodeId: string | null;
  userProgress: Record<string, { status: NodeStatus; checklist: Record<string, boolean> }>;
  onSelectNode: (node: RoadmapNode) => void;
  onQuickToggleStatus?: (nodeId: string, e: React.MouseEvent) => void;
  accentColor?: string;
  searchQuery?: string;
  statusFilter?: NodeStatus | "all";
  roadmapMode?: "full" | "my-path" | "recommended";
  levelFilter?: "all" | "Beginner" | "Intermediate" | "Advanced";
}

const statusBadgeConfig: Record<
  NodeStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  completed: {
    label: "Done",
    badgeClass: "bg-success/15 text-success border-success/30",
    icon: "✓",
  },
  "in-progress": {
    label: "Active",
    badgeClass: "bg-accent/15 text-accent border-accent/30",
    icon: "•",
  },
  planned: {
    label: "Planned",
    badgeClass: "bg-surface text-ink/70 border-ink/15",
    icon: "○",
  },
  locked: {
    label: "Locked",
    badgeClass: "bg-ink/5 text-ink/40 border-ink/10",
    icon: "—",
  },
};

export const RoadmapListView: React.FC<RoadmapListViewProps> = ({
  tiers,
  selectedNodeId,
  userProgress,
  onSelectNode,
  onQuickToggleStatus,
  accentColor = "var(--color-accent)",
  searchQuery = "",
  statusFilter = "all",
  roadmapMode = "full",
  levelFilter = "all",
}) => {
  const query = searchQuery.toLowerCase().trim();

  // Filter nodes according to search, status, mode, and level
  const filteredTiers = useMemo(() => {
    return tiers
      .map((tier) => {
        const tierNodes = [tier.trunkNode, ...(tier.branches || [])].filter((node) => {
          const effectiveStatus = userProgress[node.id]?.status || node.status;
          const { isLocked } = checkNodeLocked(node, userProgress);
          const computedStatus = isLocked ? "locked" : effectiveStatus;

          if (statusFilter !== "all" && computedStatus !== statusFilter) {
            return false;
          }

          if (levelFilter !== "all") {
            const norm = levelFilter.toLowerCase();
            const nodeLvl = (node.level || "").toLowerCase();
            const matches =
              (norm === "beginner" && (nodeLvl === "fundamental" || nodeLvl === "beginner")) ||
              (norm === "intermediate" && nodeLvl === "intermediate") ||
              (norm === "advanced" && nodeLvl === "advanced");
            if (!matches) return false;
          }

          if (roadmapMode === "my-path") {
            const isPathItem =
              computedStatus === "completed" ||
              computedStatus === "in-progress" ||
              (!isLocked && computedStatus === "planned");
            if (!isPathItem) return false;
          } else if (roadmapMode === "recommended") {
            const isTarget = node.importance === "essential" || node.importance === "recommended";
            if (!isTarget || computedStatus === "completed") return false;
          }

          if (query) {
            const inTitle = node.title.toLowerCase().includes(query);
            const inDesc = node.description.toLowerCase().includes(query);
            const inConcepts = (node.keyConcepts || []).some((c) =>
              c.toLowerCase().includes(query)
            );
            if (!inTitle && !inDesc && !inConcepts) {
              return false;
            }
          }

          return true;
        });

        return {
          ...tier,
          nodes: tierNodes,
        };
      })
      .filter((tier) => tier.nodes.length > 0);
  }, [tiers, query, statusFilter, roadmapMode, levelFilter, userProgress]);

  if (filteredTiers.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-ink/15 bg-surface p-8 max-w-md mx-auto text-ink">
        <p className="text-xs text-ink/70">No nodes match your filter in list view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {filteredTiers.map((tier) => (
        <div
          key={tier.id}
          className="rounded-xl border border-ink/15 bg-surface p-4 sm:p-5 shadow-xs text-ink"
        >
          {/* Stage Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-ink/10">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-bg font-mono text-[11px] font-bold text-accent border border-ink/15">
                0{tier.stageNumber}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink uppercase tracking-wider">
                  {tier.title}
                </h3>
                {tier.subtitle && (
                  <p className="text-[11px] text-ink/65">{tier.subtitle}</p>
                )}
              </div>
            </div>
            <span className="text-[11px] font-mono text-ink/50">
              {tier.nodes.length} topic{tier.nodes.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* List of Node Items */}
          <div className="space-y-2">
            {tier.nodes.map((node) => {
              const effectiveStatus = userProgress[node.id]?.status || node.status;
              const { isLocked } = checkNodeLocked(node, userProgress);
              const computedStatus: NodeStatus = isLocked ? "locked" : effectiveStatus;
              const badge = statusBadgeConfig[computedStatus] || statusBadgeConfig.planned;

              const totalChecklist = node.checklist.length;
              const completedCount = node.checklist.filter(
                (item) => userProgress[node.id]?.checklist?.[item.id] ?? item.completed
              ).length;
              const percent =
                totalChecklist > 0 ? Math.round((completedCount / totalChecklist) * 100) : 0;

              const isSelected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? "border-accent bg-bg shadow-sm ring-1 ring-accent/30 text-ink"
                      : isLocked
                      ? "border-ink/10 bg-surface/50 opacity-60 text-ink/60"
                      : "border-ink/15 bg-bg hover:border-ink/30 hover:bg-surface text-ink"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={(e) => {
                        if (onQuickToggleStatus && !isLocked) {
                          e.stopPropagation();
                          onQuickToggleStatus(node.id, e);
                        }
                      }}
                      className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 font-mono text-xs font-bold border transition-all ${
                        badge.badgeClass
                      } ${!isLocked ? "hover:brightness-95 cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      {badge.icon}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-ink">
                          {node.title}
                        </h4>
                        {node.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/25">
                            {node.badge}
                          </span>
                        )}
                        {node.importance === "essential" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-danger/10 text-danger border border-danger/25">
                            Core
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-ink/70 line-clamp-1 mt-0.5">
                        {node.summary || node.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center font-mono text-[11px] text-ink/60 shrink-0">
                    {totalChecklist > 0 && (
                      <span>
                        {completedCount}/{totalChecklist} done ({percent}%)
                      </span>
                    )}
                    <span>~{node.estimatedHours}h</span>
                    <span className="text-accent hover:underline">Inspect →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
