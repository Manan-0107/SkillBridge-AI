"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { RoadmapDocument, RoadmapNode } from "@/types/roadmap";
import { fetchRoadmapDocument } from "@/lib/cdn-fetch";
import { getItem, setItem, buildStorageKey } from "@/lib/storage";
import { UserProgress } from "@/types/storage";
import { SearchBar } from "@/components/roadmap/SearchBar";
import { FilterBar, StatusFilter } from "@/components/roadmap/FilterBar";
import { RoadmapTree } from "@/components/roadmap/RoadmapTree";
import { Skeleton } from "@/components/shared/Skeleton";

import { AccessibleRoadmapListView } from "@/components/roadmap/AccessibleRoadmapListView";

// Dynamic import for drawer as required by Section 8 (code-split)
const NodeDrawer = dynamic(
  () => import("@/components/roadmap/NodeDrawer").then((mod) => mod.NodeDrawer),
  { ssr: false }
);

export default function RoadmapDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const roadmapId = (params?.roadmapId as string) || "frontend";

  const [documentData, setDocumentData] = useState<RoadmapDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [completedNodeIds, setCompletedNodeIds] = useState<string[]>([]);
  const [inProgressNodeIds, setInProgressNodeIds] = useState<string[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilter[]>([
    "completed",
    "in-progress",
    "planned",
  ]);

  // Active selected node for details drawer
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);

  const loadProgress = useCallback(() => {
    const progressKey = buildStorageKey(roadmapId, "progress");
    const stored = getItem<UserProgress>(progressKey, {
      version: 1,
      completedNodeIds: [],
      inProgressNodeIds: [],
      updatedAt: new Date().toISOString(),
    });
    setCompletedNodeIds(stored.completedNodeIds || []);
    setInProgressNodeIds(stored.inProgressNodeIds || []);
    return stored;
  }, [roadmapId]);

  // Load Roadmap document directly from static CDN path
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchRoadmapDocument(roadmapId)
      .then((doc) => {
        if (cancelled) return;
        setDocumentData(doc);

        const storedProgress = loadProgress();

        // Optionally select last active node if stored
        if (storedProgress.lastSelectedNodeId) {
          const lastNode = doc.nodes.find((n) => n.id === storedProgress.lastSelectedNodeId);
          if (lastNode) setSelectedNode(lastNode);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[RoadmapPage] Failed to fetch:", err);
        setError(err instanceof Error ? err.message : "Failed to load roadmap.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roadmapId, loadProgress]);

  // Voice Action Listener: handle "mark [node] complete"
  useEffect(() => {
    const handleVoiceAction = (e: CustomEvent<{ action: string; node?: string }>) => {
      if (e.detail?.action === "mark_complete" && e.detail.node && documentData) {
        const cleanTarget = e.detail.node.toLowerCase().trim();
        const targetNode = documentData.nodes.find(
          (n) =>
            n.title.toLowerCase() === cleanTarget ||
            n.id.toLowerCase() === cleanTarget ||
            n.title.toLowerCase().includes(cleanTarget)
        );
        if (targetNode) {
          handleToggleStatus(targetNode.id);
        }
      }
    };
    window.addEventListener("careerforge:roadmap-voice-action" as any, handleVoiceAction);
    return () =>
      window.removeEventListener("careerforge:roadmap-voice-action" as any, handleVoiceAction);
  }, [documentData]);

  const handleToggleStatus = useCallback(
    (nodeId: string) => {
      const progressKey = buildStorageKey(roadmapId, "progress");
      const current = getItem<UserProgress>(progressKey, {
        version: 1,
        completedNodeIds: [],
        inProgressNodeIds: [],
        updatedAt: new Date().toISOString(),
      });

      const isCompleted = current.completedNodeIds.includes(nodeId);
      let updatedCompleted = [...current.completedNodeIds];
      let updatedInProgress = [...current.inProgressNodeIds];

      if (isCompleted) {
        updatedCompleted = updatedCompleted.filter((id) => id !== nodeId);
      } else {
        updatedCompleted.push(nodeId);
        updatedInProgress = updatedInProgress.filter((id) => id !== nodeId);
      }

      setItem(progressKey, {
        ...current,
        completedNodeIds: updatedCompleted,
        inProgressNodeIds: updatedInProgress,
        updatedAt: new Date().toISOString(),
      });

      setCompletedNodeIds(updatedCompleted);
      setInProgressNodeIds(updatedInProgress);
    },
    [roadmapId]
  );

  // Sync status filters to URL query
  const handleStatusToggle = useCallback((status: StatusFilter) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((s) => s !== status);
      }
      return [...prev, status];
    });
  }, []);

  const handleSelectNode = useCallback(
    (node: RoadmapNode) => {
      setSelectedNode(node);
      const progressKey = buildStorageKey(roadmapId, "progress");
      const current = getItem<UserProgress>(progressKey, {
        version: 1,
        completedNodeIds: [],
        inProgressNodeIds: [],
        updatedAt: new Date().toISOString(),
      });
      setItem(progressKey, {
        ...current,
        lastSelectedNodeId: node.id,
        updatedAt: new Date().toISOString(),
      });
    },
    [roadmapId]
  );

  // Progress metrics calculation
  const progressStats = useMemo(() => {
    if (!documentData) return { total: 0, completed: 0, percentage: 0 };
    const total = documentData.nodes.length;
    const completed = completedNodeIds.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  }, [documentData, completedNodeIds]);

  if (loading) {
    return (
      <main className="min-h-screen bg-charcoal-950 text-charcoal-200 p-6 flex flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <Skeleton variant="circle" className="w-12 h-12 border border-hairline" />
          <Skeleton variant="badge" className="w-32 h-4" />
        </div>
        <div className="flex flex-col gap-4 items-center">
          <Skeleton variant="node" />
          <Skeleton variant="node" />
        </div>
      </main>
    );
  }

  if (error || !documentData) {
    return (
      <main className="min-h-screen bg-charcoal-950 text-charcoal-200 p-8 flex flex-col items-center justify-center text-center">
        <div className="max-w-md p-8 rounded-2xl bg-charcoal-900 border border-hairline space-y-4">
          <div className="text-3xl">⚠️</div>
          <h1 className="text-xl font-bold text-white">Roadmap Unavailable</h1>
          <p className="text-sm text-charcoal-400">
            {error || "Could not retrieve the requested roadmap document."}
          </p>
          <Link
            href="/roadmap/frontend"
            className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-accent-500 hover:bg-accent-600 text-charcoal-950 transition-colors"
          >
            Go to Frontend Track
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-charcoal-950 text-charcoal-200 selection:bg-accent-500 selection:text-charcoal-950 flex flex-col pb-24">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-charcoal-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-semibold text-charcoal-400 hover:text-white transition-colors"
            >
              <span>←</span>
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <div className="h-4 w-[1px] bg-charcoal-700 hidden sm:block" />
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight capitalize">
              {roadmapId} Engineering Roadmap
            </h1>
          </div>

          {/* Quick Progress Indicator, View Switcher & Daily Drill shortcut */}
          <div className="flex items-center gap-3">
            {/* Accessible List View vs Graph View Toggle */}
            <div className="flex items-center rounded-xl bg-neutral-800 p-1 border border-neutral-700">
              <button
                type="button"
                onClick={() => setViewMode("graph")}
                aria-pressed={viewMode === "graph"}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === "graph"
                    ? "bg-amber-500 text-black shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Graph View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-amber-500 text-black shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Accessible List
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-charcoal-850 border border-hairline text-xs font-mono">
              <span className="text-charcoal-400">Track Progress:</span>
              <span className="font-bold text-accent-400">{progressStats.percentage}%</span>
              <div className="w-16 h-1.5 rounded-full bg-charcoal-700 overflow-hidden ml-1">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressStats.percentage}%` }}
                />
              </div>
            </div>

            <Link
              href={`/practice/${roadmapId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent-500 hover:bg-accent-600 text-charcoal-950 shadow-xs transition-colors"
            >
              <span>Daily Practice Drills</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Control Toolbar: Search & Filters (only for Graph View) */}
      {viewMode === "graph" && (
        <section className="border-b border-hairline bg-charcoal-900/50 py-4 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              className="w-full md:max-w-md"
            />

            <FilterBar
              currentTrack={roadmapId}
              selectedStatuses={selectedStatuses}
              onStatusToggle={handleStatusToggle}
            />
          </div>
        </section>
      )}

      {/* Main Roadmap Content: Graph Canvas OR Accessible List View */}
      {viewMode === "graph" ? (
        <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 overflow-x-auto">
          <RoadmapTree
            nodes={documentData.nodes}
            selectedNodeId={selectedNode?.id ?? null}
            searchQuery={searchQuery}
            filteredStatusList={selectedStatuses}
            onSelectNode={handleSelectNode}
          />
        </div>
      ) : (
        <div className="flex-1">
          <AccessibleRoadmapListView
            nodes={documentData.nodes}
            completedNodeIds={completedNodeIds}
            inProgressNodeIds={inProgressNodeIds}
            onSelectNode={handleSelectNode}
            onToggleStatus={handleToggleStatus}
          />
        </div>
      )}

      {/* Responsive Lazy-Loaded Node Details Drawer */}
      <NodeDrawer
        node={selectedNode}
        roadmapId={roadmapId}
        allNodes={documentData.nodes}
        onClose={() => setSelectedNode(null)}
        onSelectPrerequisite={(prereqId) => {
          const target = documentData.nodes.find((n) => n.id === prereqId);
          if (target) handleSelectNode(target);
        }}
      />
    </main>
  );
}
