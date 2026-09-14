"use client";

import React from "react";
import { RoadmapNode, NodeStatus } from "@/types/roadmapTree";
import { calculateRoadmapStats, getRecommendedNextTopics } from "@/lib/roadmap/roadmapData";

interface RoadmapProgressHeaderProps {
  allNodes: RoadmapNode[];
  userProgress: Record<string, { status: NodeStatus; checklist: Record<string, boolean> }>;
  onSelectNode: (node: RoadmapNode) => void;
  accentColor?: string;
  categoryTitle?: string;
}

export const RoadmapProgressHeader: React.FC<RoadmapProgressHeaderProps> = ({
  allNodes,
  userProgress,
  onSelectNode,
  accentColor = "#F59E0B",
  categoryTitle = "Engineering Roadmap",
}) => {
  const stats = calculateRoadmapStats(allNodes, userProgress);
  const { currentActive, recommendedNext } = getRecommendedNextTopics(allNodes, userProgress);

  return (
    <div className="space-y-4 mb-6">
      {/* Top Banner: Progress Bar & High-Level Metrics */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0e121d] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Roadmap Progress
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {stats.completed} / {stats.total} Completed ({stats.percent}%)
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {categoryTitle}
            </h2>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#121624] border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="text-emerald-400 font-bold">{stats.completed}</span>
              <span className="text-slate-500">Done</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#121624] border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="text-amber-400 font-bold">{stats.inProgress}</span>
              <span className="text-slate-500">Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#121624] border border-slate-800 text-[11px] font-mono text-slate-300">
              <span className="text-slate-400 font-bold">{stats.planned}</span>
              <span className="text-slate-500">Planned</span>
            </div>
            {stats.locked > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#121624] border border-slate-800 text-[11px] font-mono text-slate-400">
                <span>🔒</span>
                <span>{stats.locked} Locked</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
              <span>⏱ ~{stats.hoursRemaining}h remaining</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${stats.percent}%`,
              backgroundColor: stats.percent === 100 ? "#10B981" : accentColor,
            }}
          />
        </div>
      </div>

      {/* "What Next?" Guided Recommendation Engine Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Left Column: Current Active Topic */}
        <div className="md:col-span-5 rounded-xl border border-slate-800/80 bg-[#111522] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                Current Learning Focus
              </span>
            </div>

            {currentActive ? (
              <div>
                <h3 className="text-sm font-semibold text-white leading-snug">
                  {currentActive.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {currentActive.summary || currentActive.description}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-medium text-slate-300">
                  No topic currently in progress
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Pick a foundational topic below to start your active path.
                </p>
              </div>
            )}
          </div>

          {currentActive && (
            <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                ~{currentActive.estimatedHours}h estimated
              </span>
              <button
                type="button"
                onClick={() => onSelectNode(currentActive)}
                className="px-3 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                Continue Topic →
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Graph-Derived Recommended Next Topics */}
        <div className="md:col-span-7 rounded-xl border border-slate-800/80 bg-[#111522] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs">🎯</span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
                  Recommended Next (Prerequisites Ready)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Dependency-driven
              </span>
            </div>

            {recommendedNext.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {recommendedNext.slice(0, 2).map((node) => (
                  <div
                    key={node.id}
                    onClick={() => onSelectNode(node)}
                    className="group flex flex-col justify-between p-2.5 rounded-lg border border-slate-800/90 bg-[#0c0f18] hover:border-slate-700 hover:bg-[#131726] transition-all cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {node.level}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ~{node.estimatedHours}h
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white line-clamp-1">
                        {node.title}
                      </h4>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400 group-hover:text-amber-400">
                      <span>Start Learning</span>
                      <span>→</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Complete current milestones or inspect foundational nodes below.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
