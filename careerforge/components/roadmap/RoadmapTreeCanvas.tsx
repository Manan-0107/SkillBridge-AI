"use client";

import React, { useMemo } from "react";
import { RoadmapTier, RoadmapNode, NodeStatus } from "@/types/roadmapTree";
import { RoadmapNodeCard } from "./RoadmapNodeCard";
import {
  MilestoneCheckpoint,
  BranchSvgConnector,
  VerticalTrunkConnector,
} from "./RoadmapSvgLines";
import { checkNodeLocked } from "@/lib/roadmap/roadmapData";

interface RoadmapTreeCanvasProps {
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

export const RoadmapTreeCanvas: React.FC<RoadmapTreeCanvasProps> = ({
  tiers,
  allNodes,
  selectedNodeId,
  userProgress,
  onSelectNode,
  onQuickToggleStatus,
  accentColor = "#F59E0B",
  searchQuery = "",
  statusFilter = "all",
}) => {
  // Index all nodes for fast lookups
  const nodesMap = useMemo(() => {
    const map = new Map<string, RoadmapNode>();
    allNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [allNodes]);

  // Determine selected node ancestors & children for dynamic path lighting
  const { ancestorIds, childrenIds } = useMemo(() => {
    if (!selectedNodeId) {
      return { ancestorIds: new Set<string>(), childrenIds: new Set<string>() };
    }
    const node = nodesMap.get(selectedNodeId);
    if (!node) {
      return { ancestorIds: new Set<string>(), childrenIds: new Set<string>() };
    }

    const ancestors = new Set<string>(node.prerequisites || []);
    const children = new Set<string>(node.childrenIds || []);
    return { ancestorIds: ancestors, childrenIds: children };
  }, [selectedNodeId, nodesMap]);

  // Filter tiers according to search query and status filter
  const filteredTiers = useMemo<RoadmapTier[]>(() => {
    const query = searchQuery.toLowerCase().trim();
    const result: RoadmapTier[] = [];

    for (const tier of tiers) {
      const checkNode = (node: RoadmapNode) => {
        const effectiveStatus = userProgress[node.id]?.status || node.status;
        const { isLocked } = checkNodeLocked(node, userProgress);
        const computedStatus = isLocked ? "locked" : effectiveStatus;

        // Status filter check
        if (statusFilter !== "all" && computedStatus !== statusFilter) {
          return false;
        }

        // Search query check
        if (query) {
          const inTitle = node.title.toLowerCase().includes(query);
          const inDesc = node.description.toLowerCase().includes(query);
          const inConcepts = (node.keyConcepts || []).some((c) =>
            c.toLowerCase().includes(query)
          );
          const inSkills = (node.skills || []).some((s) => s.toLowerCase().includes(query));
          if (!inTitle && !inDesc && !inConcepts && !inSkills) {
            return false;
          }
        }

        return true;
      };

      const trunkMatches = checkNode(tier.trunkNode);
      const filteredBranches = (tier.branches || []).filter(checkNode);

      if (trunkMatches || filteredBranches.length > 0) {
        result.push({
          ...tier,
          trunkNode: tier.trunkNode,
          branches: filteredBranches,
        });
      }
    }

    return result;
  }, [tiers, searchQuery, statusFilter, userProgress]);

  if (filteredTiers.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-slate-800/80 bg-[#10131d] p-8 max-w-md mx-auto">
        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400 mb-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-white">No nodes match your filter</h3>
        <p className="mt-1 text-xs text-slate-400">
          Try clearing your search query or setting the status filter to &quot;All Nodes&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="relative max-w-5xl mx-auto py-2">
      {/* Background Architectural Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative space-y-8">
        {filteredTiers.map((tier, tierIdx) => {
          const allBranches = tier.branches || [];
          const leftBranches = allBranches.filter((b) => b.branchType === "left-branch");
          const rightBranches = allBranches.filter((b) => b.branchType !== "left-branch");

          // Evenly distribute if branchType wasn't explicitly tagged
          const effectiveLeft =
            leftBranches.length > 0
              ? leftBranches
              : allBranches.slice(0, Math.ceil(allBranches.length / 2));
          const effectiveRight =
            rightBranches.length > 0
              ? rightBranches
              : allBranches.slice(Math.ceil(allBranches.length / 2));

          // Compute milestone completion status
          const trunkStatus = userProgress[tier.trunkNode.id]?.status || tier.trunkNode.status;
          const branchesCompleted = (tier.branches || []).every(
            (b) => (userProgress[b.id]?.status || b.status) === "completed"
          );
          const isMilestoneDone = trunkStatus === "completed" && branchesCompleted;
          const isMilestoneCurrent =
            trunkStatus === "in-progress" ||
            (tier.branches || []).some(
              (b) => (userProgress[b.id]?.status || b.status) === "in-progress"
            );

          const milestoneStatus = isMilestoneDone
            ? "completed"
            : isMilestoneCurrent
            ? "current"
            : "upcoming";

          return (
            <div key={tier.id} className="relative">
              {/* Milestone Checkpoint Separator */}
              <MilestoneCheckpoint
                stageNumber={tier.stageNumber}
                title={tier.title}
                subtitle={tier.subtitle}
                status={milestoneStatus}
                accentColor={accentColor}
              />

              {/* 3-Column Branching Wing Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4 lg:gap-0 my-4">
                {/* Left Branch Wing (Columns 1-4) */}
                <div className="lg:col-span-4 flex flex-col items-center lg:items-end gap-4">
                  {effectiveLeft.map((node) => {
                    const nodeStatus = userProgress[node.id]?.status || node.status;
                    const { isLocked, missingPrereqs } = checkNodeLocked(node, userProgress);
                    const isSelected = selectedNodeId === node.id;
                    const isAncestor = ancestorIds.has(node.id);
                    const isChild = childrenIds.has(node.id);

                    return (
                      <div
                        key={node.id}
                        id={`roadmap-node-${node.id}`}
                        className="w-full max-w-sm flex items-center justify-end"
                      >
                        <div className="flex-1">
                          <RoadmapNodeCard
                            node={node}
                            status={nodeStatus}
                            checklistStates={userProgress[node.id]?.checklist || {}}
                            isLocked={isLocked}
                            missingPrereqs={missingPrereqs}
                            isSelected={isSelected}
                            isAncestor={isAncestor}
                            isChild={isChild}
                            onSelect={onSelectNode}
                            onQuickToggleStatus={onQuickToggleStatus}
                            accentColor={accentColor}
                          />
                        </div>

                        {/* SVG horizontal connector arm to center spine */}
                        <BranchSvgConnector
                          side="left"
                          isOptional={node.importance === "optional"}
                          status={nodeStatus}
                          isHighlighted={isSelected || isAncestor}
                          accentColor={accentColor}
                        />
                      </div>
                    );
                  })}
                  {effectiveLeft.length === 0 && <div className="hidden lg:block w-full" />}
                </div>

                {/* Central Spine Node (Columns 5-8) */}
                <div className="lg:col-span-4 flex flex-col items-center px-0 lg:px-4 z-10">
                  {(() => {
                    const node = tier.trunkNode;
                    const nodeStatus = userProgress[node.id]?.status || node.status;
                    const { isLocked, missingPrereqs } = checkNodeLocked(node, userProgress);
                    const isSelected = selectedNodeId === node.id;
                    const isAncestor = ancestorIds.has(node.id);
                    const isChild = childrenIds.has(node.id);

                    return (
                      <div
                        id={`roadmap-node-${node.id}`}
                        className="w-full max-w-sm"
                      >
                        <RoadmapNodeCard
                          node={node}
                          status={nodeStatus}
                          checklistStates={userProgress[node.id]?.checklist || {}}
                          isLocked={isLocked}
                          missingPrereqs={missingPrereqs}
                          isSelected={isSelected}
                          isAncestor={isAncestor}
                          isChild={isChild}
                          onSelect={onSelectNode}
                          onQuickToggleStatus={onQuickToggleStatus}
                          accentColor={accentColor}
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* Right Branch Wing (Columns 9-12) */}
                <div className="lg:col-span-4 flex flex-col items-center lg:items-start gap-4">
                  {effectiveRight.map((node) => {
                    const nodeStatus = userProgress[node.id]?.status || node.status;
                    const { isLocked, missingPrereqs } = checkNodeLocked(node, userProgress);
                    const isSelected = selectedNodeId === node.id;
                    const isAncestor = ancestorIds.has(node.id);
                    const isChild = childrenIds.has(node.id);

                    return (
                      <div
                        key={node.id}
                        id={`roadmap-node-${node.id}`}
                        className="w-full max-w-sm flex items-center justify-start"
                      >
                        {/* SVG horizontal connector arm from center spine */}
                        <BranchSvgConnector
                          side="right"
                          isOptional={node.importance === "optional"}
                          status={nodeStatus}
                          isHighlighted={isSelected || isAncestor}
                          accentColor={accentColor}
                        />

                        <div className="flex-1">
                          <RoadmapNodeCard
                            node={node}
                            status={nodeStatus}
                            checklistStates={userProgress[node.id]?.checklist || {}}
                            isLocked={isLocked}
                            missingPrereqs={missingPrereqs}
                            isSelected={isSelected}
                            isAncestor={isAncestor}
                            isChild={isChild}
                            onSelect={onSelectNode}
                            onQuickToggleStatus={onQuickToggleStatus}
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
                <VerticalTrunkConnector
                  isCompleted={isMilestoneDone}
                  isHighlighted={
                    ancestorIds.has(tier.trunkNode.id) || childrenIds.has(tier.trunkNode.id)
                  }
                  accentColor={accentColor}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
