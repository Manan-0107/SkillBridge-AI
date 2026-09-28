"use client";

import React, { useMemo } from "react";
import { RoadmapNode, Resource } from "@/types/roadmap";
import { FocusTrap } from "@/components/shared/FocusTrap";
import { Badge } from "@/components/shared/Badge";
import { ConceptChecklist } from "./ConceptChecklist";

interface NodeDrawerProps {
  node: RoadmapNode | null;
  roadmapId: string;
  allNodes: RoadmapNode[];
  onClose: () => void;
  onSelectPrerequisite: (nodeId: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function NodeDrawer({
  node,
  roadmapId,
  allNodes,
  onClose,
  onSelectPrerequisite,
  triggerRef,
}: NodeDrawerProps) {
  // Group resources by type: article, video, docs, course
  const groupedResources = useMemo(() => {
    if (!node) return {} as Record<Resource["type"], Resource[]>;
    const groups: Record<Resource["type"], Resource[]> = {
      docs: [],
      article: [],
      video: [],
      course: [],
    };
    node.resources.forEach((r) => {
      if (groups[r.type]) {
        groups[r.type].push(r);
      }
    });
    return groups;
  }, [node]);

  const prereqNodes = useMemo(() => {
    if (!node) return [];
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    return node.prerequisites
      .map((id) => nodeMap.get(id))
      .filter(Boolean) as RoadmapNode[];
  }, [node, allNodes]);

  if (!node) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Responsive Drawer Container: Desktop right drawer / Mobile bottom sheet */}
      <div className="relative w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] sm:my-auto sm:mr-6 z-10">
        <FocusTrap isActive={true} onEscape={onClose} returnFocusRef={triggerRef}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-node-title"
            className="w-full h-full bg-bg border border-ink/15 rounded-none sm:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 sm:slide-in-from-right-8 duration-200"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-ink/10 bg-surface/60">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-ink/50">
                    Depth {node.depth} · {node.track}
                  </span>
                  <Badge status={node.status} showIcon={true} />
                </div>
                <h2
                  id="drawer-node-title"
                  className="text-xl font-bold text-ink leading-snug"
                >
                  {node.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close details drawer"
                className="p-1.5 rounded-lg text-ink/50 hover:text-ink hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Description */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink/50">
                  Overview
                </h3>
                <p className="text-sm text-ink/80 leading-relaxed">
                  {node.description}
                </p>
              </div>

              {/* Prerequisites chips */}
              {prereqNodes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink/50">
                    Prerequisites
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {prereqNodes.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectPrerequisite(p.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-ink/12 hover:border-accent text-ink transition-all cursor-pointer group"
                      >
                        <span className="text-accent group-hover:translate-x-0.5 transition-transform">
                          →
                        </span>
                        <span>{p.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Concept Checklist */}
              {node.concepts.length > 0 && (
                <div className="pt-2 border-t border-ink/10">
                  <ConceptChecklist
                    roadmapId={roadmapId}
                    nodeId={node.id}
                    concepts={node.concepts}
                  />
                </div>
              )}

              {/* Grouped Resources */}
              {node.resources.length > 0 && (
                <div className="pt-2 border-t border-ink/10 space-y-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink/50">
                    Recommended Learning Resources
                  </h3>

                  {(["docs", "article", "video", "course"] as const).map((type) => {
                    const items = groupedResources[type];
                    if (!items || items.length === 0) return null;

                    const typeLabels: Record<Resource["type"], string> = {
                      docs: "Documentation",
                      article: "Deep Dive Articles",
                      video: "Video Tutorials",
                      course: "Courses & Books",
                    };

                    return (
                      <div key={type} className="space-y-2">
                        <h4 className="text-[11px] font-mono text-ink/40 uppercase tracking-wide">
                          {typeLabels[type]}
                        </h4>
                        <ul className="space-y-1.5">
                          {items.map((r, i) => (
                            <li key={i}>
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-2.5 rounded-xl bg-surface/40 border border-ink/10 hover:border-accent hover:bg-surface transition-all text-xs text-ink/80 hover:text-ink group"
                              >
                                <span className="font-medium line-clamp-1">{r.title}</span>
                                <span className="text-ink/40 group-hover:text-accent text-xs ml-2">
                                  ↗
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </FocusTrap>
      </div>
    </div>
  );
}
