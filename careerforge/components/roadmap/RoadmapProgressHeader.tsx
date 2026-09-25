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
  accentColor = "var(--color-accent)",
  categoryTitle = "Engineering Roadmap",
}) => {
  const stats = calculateRoadmapStats(allNodes, userProgress);
  const { currentActive, recommendedNext } = getRecommendedNextTopics(allNodes, userProgress);

  return (
    <div className="space-y-4 mb-6">
      {/* Top Banner: Progress Bar & High-Level Metrics */}
      <div className="rounded-xl border border-ink/15 bg-surface p-4 sm:p-5 shadow-xs text-ink">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink/65">
                Roadmap Progress
              </span>
              <span className="text-ink/30">·</span>
              <span className="text-xs font-mono text-success font-semibold">
                {stats.completed} / {stats.total} Completed ({stats.percent}%)
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-ink tracking-tight">
              {categoryTitle}
            </h2>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg border border-ink/15 text-[11px] font-mono text-ink">
              <span className="text-success font-bold">{stats.completed}</span>
              <span className="text-ink/60">Done</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg border border-ink/15 text-[11px] font-mono text-ink">
              <span className="text-accent font-bold">{stats.inProgress}</span>
              <span className="text-ink/60">Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg border border-ink/15 text-[11px] font-mono text-ink">
              <span className="text-ink/70 font-bold">{stats.planned}</span>
              <span className="text-ink/60">Planned</span>
            </div>
            {stats.locked > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg border border-ink/15 text-[11px] font-mono text-ink/60">
                <span>{stats.locked} Locked</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg border border-ink/15 text-[11px] font-mono text-ink/60">
              <span>~{stats.hoursRemaining}h remaining</span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${stats.percent}%`,
              backgroundColor: stats.percent === 100 ? "var(--color-success)" : accentColor,
            }}
          />
        </div>
      </div>

      {/* "What Next?" Guided Recommendation Engine Banner */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Left Column: Current Active Topic */}
        <div className="md:col-span-5 rounded-xl border border-ink/15 bg-surface p-4 flex flex-col justify-between text-ink">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent">
                Current Learning Focus
              </span>
            </div>

            {currentActive ? (
              <div>
                <h3 className="text-sm font-semibold text-ink leading-snug">
                  {currentActive.title}
                </h3>
                <p className="mt-1 text-xs text-ink/70 line-clamp-2 leading-relaxed">
                  {currentActive.summary || currentActive.description}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-medium text-ink/70">
                  No topic currently in progress
                </h3>
                <p className="mt-1 text-xs text-ink/50">
                  Pick a foundational topic below to start your active path.
                </p>
              </div>
            )}
          </div>

          {currentActive && (
            <div className="mt-3 pt-2.5 border-t border-ink/10 flex items-center justify-between">
              <span className="text-[11px] text-ink/60 font-mono">
                ~{currentActive.estimatedHours}h estimated
              </span>
              <button
                type="button"
                onClick={() => onSelectNode(currentActive)}
                className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-soft text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Continue Topic →
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Graph-Derived Recommended Next Topics */}
        <div className="md:col-span-7 rounded-xl border border-ink/15 bg-surface p-4 flex flex-col justify-between text-ink">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink/80">
                  Recommended Next (Prerequisites Ready)
                </span>
              </div>
              <span className="text-[10px] text-ink/50 font-mono">
                Dependency-driven
              </span>
            </div>

            {recommendedNext.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {recommendedNext.slice(0, 2).map((node) => (
                  <div
                    key={node.id}
                    onClick={() => onSelectNode(node)}
                    className="group flex flex-col justify-between p-2.5 rounded-lg border border-ink/15 bg-bg hover:border-accent hover:bg-surface transition-all cursor-pointer text-ink"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono text-ink/60 uppercase">
                          {node.level}
                        </span>
                        <span className="text-[10px] text-ink/50 font-mono">
                          ~{node.estimatedHours}h
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-ink group-hover:text-accent line-clamp-1">
                        {node.title}
                      </h4>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-ink/60 group-hover:text-accent">
                      <span>Start Learning</span>
                      <span>→</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink/50">
                Complete current milestones or inspect foundational nodes below.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
