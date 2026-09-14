"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrackId,
  NodeStatus,
  DailyPracticePayload,
  DailyPracticeState,
  StaticRoadmapPayload,
  StaticRoadmapNode,
  UserRoadmapProgress,
  PracticeStreakStats,
} from "@/types/practiceEngine";
import {
  fetchDailyPracticeFromCdn,
  fetchStaticRoadmapFromCdn,
} from "@/lib/practice/cdnClient";
import {
  loadDailyPracticeState,
  saveDailyPracticeState,
  loadStreakStats,
  recordDayCompleted,
  loadRoadmapProgress,
  saveRoadmapProgress,
} from "@/lib/practice/localStorageManager";
import { EngineControls } from "./EngineControls";
import { BranchingRoadmapGraph } from "./BranchingRoadmapGraph";
import { NodeDetailDrawer } from "./NodeDetailDrawer";
import { DailyPracticeQuiz } from "./DailyPracticeQuiz";

interface RoadmapEngineViewProps {
  initialTrack?: TrackId;
  className?: string;
}

const TRACK_ACCENTS: Record<TrackId, string> = {
  frontend: "#F59E0B",
  backend: "#6366F1",
  mobile: "#10B981",
  fullstack: "#EC4899",
};

export const RoadmapEngineView: React.FC<RoadmapEngineViewProps> = ({
  initialTrack = "frontend",
  className = "",
}) => {
  const [activeTrack, setActiveTrack] = useState<TrackId>(initialTrack);
  const [activeTab, setActiveTab] = useState<"roadmap" | "daily-practice">("roadmap");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<NodeStatus | "all">("all");

  // CDN Data States
  const [roadmapData, setRoadmapData] = useState<StaticRoadmapPayload | null>(null);
  const [practicePayload, setPracticePayload] = useState<DailyPracticePayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Local Storage States
  const [roadmapProgress, setRoadmapProgress] = useState<UserRoadmapProgress>(() =>
    loadRoadmapProgress(initialTrack)
  );
  const [practiceState, setPracticeState] = useState<DailyPracticeState>(() =>
    loadDailyPracticeState(initialTrack, new Date().toISOString().slice(0, 10))
  );
  const [streakStats, setStreakStats] = useState<PracticeStreakStats>(() =>
    loadStreakStats()
  );

  // Drawer selected node
  const [selectedNode, setSelectedNode] = useState<StaticRoadmapNode | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Fetch static data from CDN whenever track changes
  const loadCdnData = useCallback(async (track: TrackId) => {
    setIsLoading(true);
    setError(null);

    try {
      const [roadmapRes, practiceRes] = await Promise.all([
        fetchStaticRoadmapFromCdn(track),
        fetchDailyPracticeFromCdn(track),
      ]);

      setRoadmapData(roadmapRes);
      setPracticePayload(practiceRes);

      // Load local states for this track
      setRoadmapProgress(loadRoadmapProgress(track));
      setPracticeState(loadDailyPracticeState(track, todayStr));
      setStreakStats(loadStreakStats());
    } catch (err: any) {
      setError(err.message || "Failed to load static assets from CDN.");
    } finally {
      setIsLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadCdnData(activeTrack);
  }, [activeTrack, loadCdnData]);

  // Handlers for Roadmap Node Inspection
  const handleSelectNode = (node: StaticRoadmapNode) => {
    setSelectedNode(node);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  // Update node status in localStorage
  const handleNodeStatusChange = (nodeId: string, status: NodeStatus) => {
    setRoadmapProgress((prev) => {
      const next: UserRoadmapProgress = {
        ...prev,
        nodeStatuses: {
          ...prev.nodeStatuses,
          [nodeId]: status,
        },
        lastUpdated: new Date().toISOString(),
      };
      saveRoadmapProgress(next);
      return next;
    });
  };

  // Toggle checklist item in localStorage
  const handleToggleChecklist = (nodeId: string, itemId: string) => {
    setRoadmapProgress((prev) => {
      const currentTrackChecklist = prev.checklistStates[nodeId] || {};
      const nextVal = !currentTrackChecklist[itemId];
      const updatedNodeChecklist = {
        ...currentTrackChecklist,
        [itemId]: nextVal,
      };

      // Auto-update node status if all items checked
      const node = roadmapData?.nodes.find((n) => n.id === nodeId);
      let autoStatus = prev.nodeStatuses[nodeId] || node?.status || "planned";

      if (node && node.checklist.length > 0) {
        let doneCount = 0;
        node.checklist.forEach((chk) => {
          const isDone = chk.id === itemId ? nextVal : (updatedNodeChecklist[chk.id] ?? chk.completed);
          if (isDone) doneCount++;
        });

        if (doneCount === node.checklist.length) {
          autoStatus = "completed";
        } else if (doneCount > 0 && autoStatus === "planned") {
          autoStatus = "in-progress";
        }
      }

      const next: UserRoadmapProgress = {
        ...prev,
        checklistStates: {
          ...prev.checklistStates,
          [nodeId]: updatedNodeChecklist,
        },
        nodeStatuses: {
          ...prev.nodeStatuses,
          [nodeId]: autoStatus,
        },
        lastUpdated: new Date().toISOString(),
      };

      saveRoadmapProgress(next);
      return next;
    });
  };

  // Practice Engine Handlers
  const handleSavePracticeState = (newState: DailyPracticeState) => {
    setPracticeState(newState);
    saveDailyPracticeState(newState);
  };

  const handleStreakUpdate = (score: number) => {
    const updated = recordDayCompleted(todayStr, score, 10);
    setStreakStats(updated);
  };

  const currentAccent = TRACK_ACCENTS[activeTrack] || "#F59E0B";

  return (
    <div
      className={`w-full bg-[#0d1017] text-slate-100 rounded-2xl border border-slate-800/80 p-4 sm:p-8 shadow-xl relative overflow-hidden ${className}`}
    >
      {/* Background Architectural Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Main Title & Subtitle */}
      <div className="relative z-10 max-w-5xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: currentAccent }}
              />
              <span className="uppercase tracking-wider font-mono text-[11px] text-slate-400">
                {activeTrack} curriculum &amp; practice
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {roadmapData?.title || `${activeTrack.toUpperCase()} Engineering Roadmap`}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {roadmapData?.description ||
                "Interactive branching roadmap and 10 daily practice interview drills."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-end">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Static CDN · Local Cache</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="relative z-10 max-w-5xl mx-auto">
        <EngineControls
          activeTrack={activeTrack}
          onTrackChange={(track) => setActiveTrack(track)}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          statusFilter={statusFilter}
          onStatusFilterChange={(st) => setStatusFilter(st)}
          streakStats={streakStats}
        />
      </div>

      {/* Loading Skeleton (Zero CLS) */}
      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 max-w-md mx-auto text-center">
          <div className="h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-400 font-mono">
            Loading {activeTrack} roadmap data...
          </p>
        </div>
      )}

      {/* Error Fallback */}
      {error && (
        <div className="py-10 text-center max-w-md mx-auto bg-rose-950/20 border border-rose-900/60 rounded-xl p-5">
          <p className="text-xs font-semibold text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => loadCdnData(activeTrack)}
            className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Content Rendering */}
      {!isLoading && (
        <div className="relative z-10">
          {activeTab === "roadmap" && roadmapData && (
            <BranchingRoadmapGraph
              roadmap={roadmapData}
              selectedNodeId={selectedNode?.id || null}
              nodeStatuses={roadmapProgress.nodeStatuses}
              checklistStates={roadmapProgress.checklistStates}
              onSelectNode={handleSelectNode}
              accentColor={currentAccent}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
            />
          )}

          {activeTab === "daily-practice" && practicePayload && (
            <DailyPracticeQuiz
              payload={practicePayload}
              practiceState={practiceState}
              onSaveState={handleSavePracticeState}
              streakStats={streakStats}
              onStreakUpdate={handleStreakUpdate}
              accentColor={currentAccent}
            />
          )}
        </div>
      )}

      {/* Node Detail Drawer / Bottom Sheet */}
      <NodeDetailDrawer
        node={selectedNode}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        status={
          selectedNode
            ? roadmapProgress.nodeStatuses[selectedNode.id] || selectedNode.status
            : "planned"
        }
        checklistStates={
          selectedNode ? roadmapProgress.checklistStates[selectedNode.id] || {} : {}
        }
        onToggleChecklist={handleToggleChecklist}
        onStatusChange={handleNodeStatusChange}
        accentColor={currentAccent}
      />
    </div>
  );
};
