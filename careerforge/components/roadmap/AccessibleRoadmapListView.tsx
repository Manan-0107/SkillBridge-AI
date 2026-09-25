"use client";

import React from "react";
import { RoadmapNode } from "@/types/roadmap";
import { Badge } from "@/components/shared/Badge";

interface AccessibleRoadmapListViewProps {
  nodes: RoadmapNode[];
  completedNodeIds: string[];
  inProgressNodeIds: string[];
  onSelectNode: (node: RoadmapNode) => void;
  onToggleStatus: (nodeId: string) => void;
}

export function AccessibleRoadmapListView({
  nodes,
  completedNodeIds,
  inProgressNodeIds,
  onSelectNode,
  onToggleStatus,
}: AccessibleRoadmapListViewProps) {
  // Group nodes by tier or depth
  const tiers = React.useMemo(() => {
    const groups: { [key: number]: RoadmapNode[] } = {};
    for (const node of nodes) {
      const tier = node.depth ?? 1;
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(node);
    }
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [nodes]);

  const getTierTitle = (tierStr: string) => {
    const tier = Number(tierStr);
    switch (tier) {
      case 1:
        return "Tier 1 — Core Fundamentals";
      case 2:
        return "Tier 2 — Intermediate Architecture & Logic";
      case 3:
        return "Tier 3 — Advanced Ecosystem & Performance";
      case 4:
        return "Tier 4 — Production, Security & DevOps";
      default:
        return `Tier ${tier} Modules`;
    }
  };

  return (
    <nav
      aria-label="Accessible Learning Roadmap Sequential List"
      className="w-full max-w-4xl mx-auto py-6 px-4 space-y-8"
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Accessible Roadmap List View</h2>
        <p className="text-sm text-neutral-300">
          This accessible list presents all learning modules in logical sequential order. You can
          navigate using Tab and arrow keys, toggle completion status, or press Enter to inspect
          concept checklists and learning resources.
        </p>
      </div>

      {tiers.map(([tierNum, tierNodes]) => (
        <section key={tierNum} aria-labelledby={`tier-heading-${tierNum}`} className="space-y-4">
          <div className="border-b border-neutral-800 pb-2">
            <h3
              id={`tier-heading-${tierNum}`}
              className="text-lg font-bold text-amber-400 flex items-center gap-2"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
              {getTierTitle(tierNum)} ({tierNodes.length} topics)
            </h3>
          </div>

          <ul role="list" className="space-y-3">
            {tierNodes.map((node) => {
              const isCompleted = completedNodeIds.includes(node.id);
              const isInProgress = inProgressNodeIds.includes(node.id);
              const status = isCompleted ? "completed" : isInProgress ? "in-progress" : "planned";

              return (
                <li
                  key={node.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 transition-all hover:border-neutral-700 hover:bg-neutral-850 focus-within:ring-2 focus-within:ring-amber-400"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Node Info & Description */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-base font-semibold text-white">
                          {node.title}
                        </h4>
                        <Badge status={status} />
                        {(node as any).estHours && (
                          <span className="text-xs text-neutral-400 font-mono">
                            ~{(node as any).estHours} hrs
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-300 line-clamp-2">
                        {node.description}
                      </p>
                      {node.concepts && node.concepts.length > 0 && (
                        <p className="text-xs text-neutral-400">
                          {node.concepts.length} key sub-concepts:{" "}
                          {node.concepts.map((c) => c.label).slice(0, 3).join(", ")}
                          {node.concepts.length > 3 ? "..." : ""}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleStatus(node.id)}
                        aria-label={`Toggle status for ${node.title}. Currently ${status}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          isCompleted
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900"
                            : isInProgress
                            ? "bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900"
                            : "bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700"
                        }`}
                      >
                        {isCompleted ? "✓ Completed" : isInProgress ? "⚡ In Progress" : "Mark Done"}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectNode(node)}
                        aria-label={`Inspect resources and checklist for ${node.title}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        Details & Checklist →
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
