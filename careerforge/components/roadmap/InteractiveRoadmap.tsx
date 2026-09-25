"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  RoadmapTreeData,
  RoadmapNode,
  TechCategory,
  NodeStatus,
  RoadmapApiResponse,
} from "@/types/roadmapTree";
import { getRoadmapTrackData } from "@/lib/roadmap/roadmapData";
import { RoadmapProgressHeader } from "./RoadmapProgressHeader";
import { RoadmapControls } from "./RoadmapControls";
import { RoadmapTreeCanvas } from "./RoadmapTreeCanvas";
import { RoadmapListView } from "./RoadmapListView";
import { RoadmapDrawer } from "./RoadmapDrawer";

export interface InteractiveRoadmapProps {
  apiEndpoint?: string;
  initialCategory?: TechCategory;
  onNodeSelect?: (node: RoadmapNode) => void;
  onStatusChange?: (nodeId: string, status: NodeStatus) => void;
  className?: string;
}

const CATEGORY_ACCENTS: Record<TechCategory, string> = {
  "data-ai": "var(--color-accent)",
  frontend: "var(--color-info)",
  backend: "var(--color-accent)",
  devops: "var(--color-success)",
  "system-design": "var(--color-accent)",
  fullstack: "var(--color-info)",
};

export const InteractiveRoadmap: React.FC<InteractiveRoadmapProps> = ({
  apiEndpoint = "/api/roadmap",
  initialCategory = "data-ai",
  onNodeSelect,
  onStatusChange,
  className = "",
}) => {
  const [category, setCategory] = useState<TechCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<NodeStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");

  const [treeData, setTreeData] = useState<RoadmapTreeData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected node for slide-over drawer
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Local user progress override storage: { [nodeId]: { status: NodeStatus, checklist: { [checkId]: boolean } } }
  const [userProgress, setUserProgress] = useState<
    Record<string, { status: NodeStatus; checklist: Record<string, boolean> }>
  >({});

  // Sync initialCategory prop if changed externally
  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [initialCategory]);

  // Load user progress from localStorage for current category
  useEffect(() => {
    try {
      const storageKey = `careerforge.roadmap_user_progress.${category}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setUserProgress(JSON.parse(saved));
      } else {
        setUserProgress({});
      }
    } catch {
      setUserProgress({});
    }
  }, [category]);

  // Save progress helper
  const saveUserProgress = useCallback(
    (
      updater: (
        prev: Record<string, { status: NodeStatus; checklist: Record<string, boolean> }>
      ) => Record<string, { status: NodeStatus; checklist: Record<string, boolean> }>
    ) => {
      setUserProgress((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(
            `careerforge.roadmap_user_progress.${category}`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        return next;
      });
    },
    [category]
  );

  // Fetch roadmap data using standard browser fetch with fallback to client data
  const fetchRoadmapData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = new URL(apiEndpoint, window.location.origin);
      url.searchParams.set("category", category);
      if (searchQuery) url.searchParams.set("search", searchQuery);
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch roadmap tree`);
      }

      const json: RoadmapApiResponse = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || "Invalid roadmap response format");
      }

      setTreeData(json.data);
    } catch {
      // Graceful fallback to static client dataset so the UI is 100% resilient offline
      const fallback = getRoadmapTrackData(category);
      setTreeData(fallback);
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, category, searchQuery, statusFilter]);

  // Initial fetch and on category/filter change
  useEffect(() => {
    fetchRoadmapData();
  }, [fetchRoadmapData]);

  // Handle node selection
  const handleSelectNode = useCallback(
    (node: RoadmapNode) => {
      setSelectedNode(node);
      setIsDrawerOpen(true);
      if (onNodeSelect) {
        onNodeSelect(node);
      }
    },
    [onNodeSelect]
  );

  // Handle status changes (Completed / In-Progress / Planned)
  const handleStatusChange = useCallback(
    (nodeId: string, nextStatus: NodeStatus) => {
      saveUserProgress((prev) => {
        const currentEntry = prev[nodeId] || { status: "planned", checklist: {} };
        const updatedChecklist = { ...currentEntry.checklist };

        // If marking complete, automatically check all items in checklist
        const targetNode = treeData?.allNodes.find((n) => n.id === nodeId);
        if (nextStatus === "completed" && targetNode) {
          targetNode.checklist.forEach((item) => {
            updatedChecklist[item.id] = true;
          });
        }

        return {
          ...prev,
          [nodeId]: {
            ...currentEntry,
            status: nextStatus,
            checklist: updatedChecklist,
          },
        };
      });

      if (onStatusChange) {
        onStatusChange(nodeId, nextStatus);
      }
    },
    [saveUserProgress, onStatusChange, treeData]
  );

  // Quick toggle status by clicking badge on card
  const handleQuickToggleStatus = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const current = userProgress[nodeId]?.status || "planned";
      const nextMap: Record<NodeStatus, NodeStatus> = {
        planned: "in-progress",
        "in-progress": "completed",
        completed: "planned",
        locked: "planned",
      };
      handleStatusChange(nodeId, nextMap[current]);
    },
    [userProgress, handleStatusChange]
  );

  // Handle subtopic checklist toggle
  const handleChecklistToggle = useCallback(
    (nodeId: string, checklistItemId: string) => {
      saveUserProgress((prev) => {
        const currentEntry = prev[nodeId] || { status: "planned", checklist: {} };
        const nextVal = !currentEntry.checklist[checklistItemId];
        const updatedChecklist = {
          ...currentEntry.checklist,
          [checklistItemId]: nextVal,
        };

        // Check if all subtopics are completed
        const node = treeData?.allNodes.find((n) => n.id === nodeId);
        let autoStatus = currentEntry.status;

        if (node && node.checklist.length > 0) {
          let count = 0;
          node.checklist.forEach((item) => {
            const isDone =
              item.id === checklistItemId
                ? nextVal
                : (updatedChecklist[item.id] ?? item.completed);
            if (isDone) count++;
          });

          if (count === node.checklist.length) {
            autoStatus = "completed";
          } else if (count > 0 && autoStatus === "planned") {
            autoStatus = "in-progress";
          }
        }

        return {
          ...prev,
          [nodeId]: {
            ...currentEntry,
            status: autoStatus,
            checklist: updatedChecklist,
          },
        };
      });
    },
    [saveUserProgress, treeData]
  );

  // Reset progress for this track
  const handleResetProgress = useCallback(() => {
    if (window.confirm(`Reset your progress for the ${category} roadmap?`)) {
      setUserProgress({});
      try {
        localStorage.removeItem(`careerforge.roadmap_user_progress.${category}`);
      } catch {
        // ignore
      }
    }
  }, [category]);

  const currentAccent = CATEGORY_ACCENTS[category] || "var(--color-accent)";

  return (
    <div
      className={`w-full bg-surface text-ink rounded-2xl border border-ink/15 p-4 sm:p-7 shadow-xs relative overflow-hidden ${className}`}
    >
      {/* Background Architectural Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(rgba(20, 17, 15, 0.25) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10">
        {/* Top Progress & Guided "What Next" Header */}
        {treeData && (
          <RoadmapProgressHeader
            allNodes={treeData.allNodes}
            userProgress={userProgress}
            onSelectNode={handleSelectNode}
            accentColor={currentAccent}
            categoryTitle={treeData.title}
          />
        )}

        {/* Toolbar Controls: Categories, Search, Filters, View Mode */}
        {treeData && (
          <RoadmapControls
            categories={treeData.categories}
            activeCategory={category}
            onCategoryChange={(cat) => setCategory(cat)}
            searchQuery={searchQuery}
            onSearchChange={(q) => setSearchQuery(q)}
            statusFilter={statusFilter}
            onStatusFilterChange={(st) => setStatusFilter(st)}
            viewMode={viewMode}
            onViewModeChange={(mode) => setViewMode(mode)}
            allNodes={treeData.allNodes}
            onSelectNode={handleSelectNode}
            onResetProgress={handleResetProgress}
          />
        )}

        {/* Loading Spinner */}
        {isLoading && !treeData && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 max-w-md mx-auto text-center">
            <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-ink/70">
              Loading {category} visual roadmap...
            </p>
          </div>
        )}

        {/* Error Callout */}
        {error && !treeData && (
          <div className="py-10 text-center max-w-md mx-auto bg-danger/10 border border-danger/30 rounded-xl p-5">
            <p className="text-xs font-semibold text-danger">{error}</p>
            <button
              type="button"
              onClick={fetchRoadmapData}
              className="mt-3 px-3 py-1.5 rounded-lg bg-surface hover:bg-bg text-xs font-medium text-ink border border-ink/20 transition-colors"
            >
              Retry Loading
            </button>
          </div>
        )}

        {/* Content View: Tree Graph or Structured List */}
        {treeData && (
          <div className="mt-4">
            {viewMode === "tree" ? (
              <RoadmapTreeCanvas
                tiers={treeData.tiers}
                allNodes={treeData.allNodes}
                selectedNodeId={selectedNode?.id || null}
                userProgress={userProgress}
                onSelectNode={handleSelectNode}
                onQuickToggleStatus={handleQuickToggleStatus}
                accentColor={currentAccent}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
              />
            ) : (
              <RoadmapListView
                tiers={treeData.tiers}
                allNodes={treeData.allNodes}
                selectedNodeId={selectedNode?.id || null}
                userProgress={userProgress}
                onSelectNode={handleSelectNode}
                onQuickToggleStatus={handleQuickToggleStatus}
                accentColor={currentAccent}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
              />
            )}
          </div>
        )}

        {/* Node Detail Slide-Over Drawer */}
        <RoadmapDrawer
          node={selectedNode}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          status={
            selectedNode
              ? userProgress[selectedNode.id]?.status || selectedNode.status
              : "planned"
          }
          checklistStates={
            selectedNode ? userProgress[selectedNode.id]?.checklist || {} : {}
          }
          onStatusChange={handleStatusChange}
          onChecklistToggle={handleChecklistToggle}
          onNavigateToNode={(nodeId) => {
            const nextNode = treeData?.allNodes.find((n) => n.id === nodeId);
            if (nextNode) {
              handleSelectNode(nextNode);
            }
          }}
          accentColor={currentAccent}
        />
      </div>
    </div>
  );
};
