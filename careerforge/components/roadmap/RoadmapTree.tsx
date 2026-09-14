"use client";

import React, { useMemo, useRef, useCallback } from "react";
import { RoadmapNode as RoadmapNodeType } from "@/types/roadmap";
import {
  computeGraphLayout,
  computeAncestorsAndDescendants,
  NodeLayout,
} from "@/lib/graph";
import { RoadmapNode } from "./RoadmapNode";
import { Connector } from "./Connector";

interface RoadmapTreeProps {
  nodes: RoadmapNodeType[];
  selectedNodeId: string | null;
  searchQuery: string;
  filteredStatusList: ("completed" | "in-progress" | "planned")[];
  onSelectNode: (node: RoadmapNodeType) => void;
  className?: string;
}

export function RoadmapTree({
  nodes,
  selectedNodeId,
  searchQuery,
  filteredStatusList,
  onSelectNode,
  className = "",
}: RoadmapTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Filter nodes based on user's active status filters
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => filteredStatusList.includes(n.status));
  }, [nodes, filteredStatusList]);

  // 2. Pure memoized layout calculation
  const layout = useMemo(() => {
    return computeGraphLayout(visibleNodes, 1080);
  }, [visibleNodes]);

  // 3. Pure memoized selection derivation
  const selectionGraph = useMemo(() => {
    return computeAncestorsAndDescendants(selectedNodeId, visibleNodes);
  }, [selectedNodeId, visibleNodes]);

  // 4. Search matching set
  const searchMatchingIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase().trim();
    const matching = new Set<string>();

    visibleNodes.forEach((node) => {
      const matchTitle = node.title.toLowerCase().includes(query);
      const matchDesc = node.description.toLowerCase().includes(query);
      const matchConcept = node.concepts.some((c) =>
        c.label.toLowerCase().includes(query)
      );

      if (matchTitle || matchDesc || matchConcept) {
        matching.add(node.id);
      }
    });

    return matching;
  }, [visibleNodes, searchQuery]);

  // Roving keyboard navigation helper
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentNode: RoadmapNodeType) => {
      if (!layout.nodes.length) return;

      const currentIndex = layout.nodes.findIndex((n) => n.id === currentNode.id);
      let nextIndex = -1;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % layout.nodes.length;
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + layout.nodes.length) % layout.nodes.length;
      }

      if (nextIndex >= 0) {
        const targetNode = layout.nodes[nextIndex].node;
        onSelectNode(targetNode);
        const el = containerRef.current?.querySelector<HTMLElement>(
          `[aria-label*="${targetNode.title}"]`
        );
        el?.focus();
      }
    },
    [layout.nodes, onSelectNode]
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-x-auto overflow-y-visible py-8 ${className}`}
      role="tree"
      aria-label="Interactive Learning Roadmap Tree"
    >
      <div
        className="relative mx-auto"
        style={{
          width: `${layout.canvasWidth}px`,
          minHeight: `${layout.canvasHeight}px`,
        }}
      >
        {/* SVG Connectors Canvas */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: "visible" }}
          aria-hidden="true"
        >
          {layout.connectors.map((c) => {
            const isSelectedBranch =
              selectedNodeId !== null &&
              ((c.fromId === selectedNodeId && selectionGraph.directChildIds.has(c.toId)) ||
                (c.toId === selectedNodeId && selectionGraph.directParentIds.has(c.fromId)));

            const isDimmed =
              selectedNodeId !== null &&
              !isSelectedBranch &&
              !selectionGraph.allAncestorIds.has(c.fromId) &&
              !selectionGraph.allDescendantIds.has(c.toId);

            return (
              <Connector
                key={c.id}
                connector={c}
                isSelectedBranch={isSelectedBranch}
                isDimmed={isDimmed}
              />
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {layout.nodes.map((layoutNode, index) => {
          const isSelected = selectedNodeId === layoutNode.id;
          const isAncestor = selectionGraph.allAncestorIds.has(layoutNode.id);
          const isChild = selectionGraph.directChildIds.has(layoutNode.id);
          const isDimmed =
            selectedNodeId !== null &&
            !isSelected &&
            !isAncestor &&
            !isChild &&
            !selectionGraph.allDescendantIds.has(layoutNode.id);

          const isSearchMatch = searchMatchingIds.has(layoutNode.id);

          // Roving tabindex: focused item is 0, others -1
          const tabIndex = isSelected || (selectedNodeId === null && index === 0) ? 0 : -1;

          return (
            <RoadmapNode
              key={layoutNode.id}
              node={layoutNode.node}
              x={layoutNode.x}
              y={layoutNode.y}
              width={layoutNode.width}
              height={layoutNode.height}
              isSelected={isSelected}
              isAncestor={isAncestor}
              isChild={isChild}
              isDimmed={isDimmed}
              isSearchMatch={isSearchMatch}
              tabIndex={tabIndex}
              onClick={onSelectNode}
              onKeyDown={handleKeyDown}
            />
          );
        })}
      </div>
    </div>
  );
}
