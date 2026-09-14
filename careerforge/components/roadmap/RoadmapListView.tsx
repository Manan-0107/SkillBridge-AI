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
}

const statusBadgeConfig: Record<
  NodeStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  completed: {
    label: "Done",
    badgeClass: "bg-emerald-950/40 text-emerald-300 border-emerald-700/60",
    icon: "✓",
  },
  "in-progress": {
    label: "Active",
    badgeClass: "bg-amber-950/40 text-amber-300 border-amber-700/60",
    icon: "⚡",
  },
  planned: {
    label: "Planned",
    badgeClass: "bg-slate-900/60 text-slate-400 border-slate-800",
    icon: "○",
  },
  locked: {
    label: "Locked",
    badgeClass: "bg-slate-950 text-slate-500 border-slate-900",
    icon: "🔒",
  },
};

export const RoadmapListView: React.FC<RoadmapListViewProps> = ({
  tiers,
  selectedNodeId,
  userProgress,
  onSelectNode,
  onQuickToggleStatus,
  accentColor = "#F59E0B",
  searchQuery = "",
  statusFilter = "all",
}) => {
  const query = searchQuery.toLowerCase().trim();

  // Filter nodes according to search and status
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
  }, [tiers, query, statusFilter, userProgress]);

  if (filteredTiers.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-slate-800 bg-[#10131d] p-8 max-w-md mx-auto">
        <p className="text-xs text-slate-400">No nodes match your filter in list view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {filteredTiers.map((tier) => (
        <div
          key={tier.id}
          className="rounded-xl border border-slate-800/80 bg-[#0f121d] p-4 sm:p-5 shadow-sm"
        >
          {/* Stage Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#161a28] font-mono text-[11px] font-bold text-amber-400 border border-slate-800">
                0{tier.stageNumber}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  {tier.title}
                </h3>
                {tier.subtitle && (
                  <p className="text-[11px] text-slate-400">{tier.subtitle}</p>
                )}
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {tier.nodes.length} topic{tier.nodes.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* List of Node Items */}
          <div className="space-y-2">
            {tier.nodes.map((node) => {
              const effectiveStatus = userProgress[node.id]?.status || node.status;
              const { isLocked, missingPrereqs } = checkNodeLocked(node, userProgress);
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
                      ? "border-amber-400 bg-[#161a28] shadow-sm"
                      : isLocked
                      ? "border-slate-800/60 bg-[#0c0e16]/60 opacity-75"
                      : "border-slate-800/80 bg-[#121522] hover:border-slate-700 hover:bg-[#151928]"
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
                      } ${!isLocked ? "hover:brightness-125" : "cursor-not-allowed"}`}
                    >
                      {badge.icon}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-100">
                          {node.title}
                        </h4>
                        {node.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-950/40 text-amber-400 border border-amber-800/50">
                            {node.badge}
                          </span>
                        )}
                        {node.importance === "essential" && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-950/40 text-rose-300 border border-rose-800/50">
                            Core
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {node.summary || node.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center font-mono text-[11px] text-slate-400 shrink-0">
                    {totalChecklist > 0 && (
                      <span>
                        {completedCount}/{totalChecklist} done ({percent}%)
                      </span>
                    )}
                    <span>~{node.estimatedHours}h</span>
                    <span className="text-slate-500 hover:text-white">Inspect →</span>
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
