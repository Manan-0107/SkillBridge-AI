"use client";

import React, { useMemo } from "react";
import { StaticRoadmapPayload, StaticRoadmapNode, NodeStatus } from "@/types/practiceEngine";
import { RoadmapNodeCard } from "./RoadmapNodeCard";

interface BranchingRoadmapGraphProps {
  roadmap: StaticRoadmapPayload;
  selectedNodeId: string | null;
  nodeStatuses: Record<string, NodeStatus>;
  checklistStates: Record<string, Record<string, boolean>>;
  onSelectNode: (node: StaticRoadmapNode) => void;
  accentColor?: string;
  searchQuery?: string;
  statusFilter?: NodeStatus | "all";
}

export const BranchingRoadmapGraph: React.FC<BranchingRoadmapGraphProps> = ({
  roadmap,
  selectedNodeId,
  nodeStatuses,
  checklistStates,
  onSelectNode,
  accentColor = "#00F2FE",
  searchQuery = "",
  statusFilter = "all",
}) => {
  // Map of all nodes by ID for fast ancestor/child lookups
  const nodesById = useMemo(() => {
    const map = new Map<string, StaticRoadmapNode>();
    roadmap.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [roadmap]);

  // Set of ancestors and children of the selected node for path highlighting
  const { ancestorIds, childrenIds } = useMemo(() => {
    if (!selectedNodeId) return { ancestorIds: new Set<string>(), childrenIds: new Set<string>() };

    const selected = nodesById.get(selectedNodeId);
    if (!selected) return { ancestorIds: new Set<string>(), childrenIds: new Set<string>() };

    const ancestors = new Set<string>(selected.prerequisites || []);
    const children = new Set<string>(selected.childrenIds || []);

    return { ancestorIds: ancestors, childrenIds: children };
  }, [selectedNodeId, nodesById]);

  // Filter nodes according to search and status filter
  const filteredTiers = useMemo(() => {
    const cleanSearch = searchQuery.toLowerCase().trim();

    return roadmap.tiers
      .map((tier) => {
        const tierNodes = roadmap.nodes.filter((node) => {
          if (node.tierNumber !== tier.tierNumber) return false;

          const currentStatus = nodeStatuses[node.id] || node.status;
          if (statusFilter !== "all" && currentStatus !== statusFilter) return false;

          if (cleanSearch) {
            const matchesTitle = node.title.toLowerCase().includes(cleanSearch);
            const matchesDesc = node.description.toLowerCase().includes(cleanSearch);
            const matchesConcepts = node.keyConcepts.some((c) =>
              c.toLowerCase().includes(cleanSearch)
            );
            if (!matchesTitle && !matchesDesc && !matchesConcepts) return false;
          }

          return true;
        });

        return {
          ...tier,
          nodes: tierNodes,
        };
      })
      .filter((tier) => tier.nodes.length > 0);
  }, [roadmap, searchQuery, statusFilter, nodeStatuses]);

  if (filteredTiers.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-slate-800/80 bg-[#10131d] p-8 max-w-md mx-auto">
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400 mb-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-white">No matching roadmap nodes found</h3>
        <p className="mt-1 text-xs text-slate-400">
          Try clearing your search query or setting the status filter to &quot;All Nodes&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="relative max-w-5xl mx-auto py-2">
      <div className="relative space-y-12">
        {filteredTiers.map((tier, tierIdx) => {
          const leftNodes = tier.nodes.filter((n) => n.position.column === "left");
          const centerNodes = tier.nodes.filter((n) => n.position.column === "center");
          const rightNodes = tier.nodes.filter((n) => n.position.column === "right");

          // If no center nodes were positioned, assign the first node to center
          const effectiveCenter =
            centerNodes.length > 0
              ? centerNodes
              : [tier.nodes[0]];
          const effectiveLeft =
            centerNodes.length > 0
              ? leftNodes
              : tier.nodes.slice(1, Math.ceil(tier.nodes.length / 2));
          const effectiveRight =
            centerNodes.length > 0
              ? rightNodes
              : tier.nodes.slice(Math.ceil(tier.nodes.length / 2));

          return (
            <div key={tier.tierNumber} className="relative">
              {/* Milestone Hub Separator Header */}
              <div className="relative flex items-center justify-center my-6 z-10">
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <div className="w-full border-t border-slate-800/80" />
                </div>
                <div className="relative flex flex-col items-center bg-[#0d1017] px-4">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#131622] border border-slate-700/80 shadow-sm">
                    <span className="font-mono text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                      STAGE 0{tier.tierNumber}
                    </span>
                    <span className="text-slate-600">·</span>
                    <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                      {tier.title}
                    </h4>
                  </div>
                  {tier.subtitle && (
                    <span className="text-[11px] text-slate-400 mt-1">{tier.subtitle}</span>
                  )}
                </div>
              </div>

              {/* 3-Column Branching Wing Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4 lg:gap-0 my-4">
                {/* Left Branch Wing (Cols 1-4) */}
                <div className="lg:col-span-4 flex flex-col items-center lg:items-end gap-4">
                  {effectiveLeft.map((node) => {
                    const status = nodeStatuses[node.id] || node.status;
                    const nodeChecklist = checklistStates[node.id] || {};
                    const completedChecklistCount = node.checklist.filter(
                      (item) => nodeChecklist[item.id] ?? item.completed
                    ).length;

                    return (
                      <div
                        key={node.id}
                        className="w-full max-w-sm flex items-center justify-end"
                      >
                        <div className="flex-1">
                          <RoadmapNodeCard
                            node={node}
                            effectiveStatus={status}
                            checklistCompletedCount={completedChecklistCount}
                            isSelected={selectedNodeId === node.id}
                            isAncestor={ancestorIds.has(node.id)}
                            isChild={childrenIds.has(node.id)}
                            onSelect={onSelectNode}
                            accentColor={accentColor}
                          />
                        </div>
                        {/* SVG horizontal connector arm to center */}
                        <div className="hidden lg:flex items-center w-8 shrink-0 justify-end">
                          <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
                            <path
                              d="M32 8 H0"
                              stroke={
                                selectedNodeId === node.id || ancestorIds.has(node.id)
                                  ? "#F59E0B"
                                  : status === "completed"
                                  ? "#10B981"
                                  : "#334155"
                              }
                              strokeWidth="1.5"
                            />
                            <circle
                              cx="4"
                              cy="8"
                              r="2.5"
                              fill={status === "completed" ? "#10B981" : "#475569"}
                            />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                  {effectiveLeft.length === 0 && <div className="hidden lg:block w-full" />}
                </div>

                {/* Central Spine Node (Cols 5-8) */}
                <div className="lg:col-span-4 flex flex-col items-center px-0 lg:px-4 z-10">
                  {effectiveCenter.map((node) => {
                    const status = nodeStatuses[node.id] || node.status;
                    const nodeChecklist = checklistStates[node.id] || {};
                    const completedChecklistCount = node.checklist.filter(
                      (item) => nodeChecklist[item.id] ?? item.completed
                    ).length;

                    return (
                      <div key={node.id} className="w-full max-w-sm">
                        <RoadmapNodeCard
                          node={node}
                          effectiveStatus={status}
                          checklistCompletedCount={completedChecklistCount}
                          isSelected={selectedNodeId === node.id}
                          isAncestor={ancestorIds.has(node.id)}
                          isChild={childrenIds.has(node.id)}
                          onSelect={onSelectNode}
                          accentColor={accentColor}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Right Branch Wing (Cols 9-12) */}
                <div className="lg:col-span-4 flex flex-col items-center lg:items-start gap-4">
                  {effectiveRight.map((node) => {
                    const status = nodeStatuses[node.id] || node.status;
                    const nodeChecklist = checklistStates[node.id] || {};
                    const completedChecklistCount = node.checklist.filter(
                      (item) => nodeChecklist[item.id] ?? item.completed
                    ).length;

                    return (
                      <div
                        key={node.id}
                        className="w-full max-w-sm flex items-center justify-start"
                      >
                        {/* SVG horizontal connector arm from center */}
                        <div className="hidden lg:flex items-center w-8 shrink-0 justify-start">
                          <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
                            <path
                              d="M0 8 H32"
                              stroke={
                                selectedNodeId === node.id || ancestorIds.has(node.id)
                                  ? "#F59E0B"
                                  : status === "completed"
                                  ? "#10B981"
                                  : "#334155"
                              }
                              strokeWidth="1.5"
                            />
                            <circle
                              cx="28"
                              cy="8"
                              r="2.5"
                              fill={status === "completed" ? "#10B981" : "#475569"}
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <RoadmapNodeCard
                            node={node}
                            effectiveStatus={status}
                            checklistCompletedCount={completedChecklistCount}
                            isSelected={selectedNodeId === node.id}
                            isAncestor={ancestorIds.has(node.id)}
                            isChild={childrenIds.has(node.id)}
                            onSelect={onSelectNode}
                            accentColor={accentColor}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {effectiveRight.length === 0 && <div className="hidden lg:block w-full" />}
                </div>
              </div>

              {/* Vertical Trunk Line to Next Tier */}
              {tierIdx < filteredTiers.length - 1 && (
                <div className="flex justify-center my-3">
                  <div className="w-[1.5px] h-8 bg-slate-800" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
