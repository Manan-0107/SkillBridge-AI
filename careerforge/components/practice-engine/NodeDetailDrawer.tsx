"use client";

import React, { useEffect } from "react";
import { StaticRoadmapNode, NodeStatus } from "@/types/practiceEngine";

interface NodeDetailDrawerProps {
  node: StaticRoadmapNode | null;
  isOpen: boolean;
  onClose: () => void;
  status: NodeStatus;
  checklistStates: Record<string, boolean>;
  onToggleChecklist: (nodeId: string, itemId: string) => void;
  onStatusChange: (nodeId: string, status: NodeStatus) => void;
  onNavigateToNode?: (nodeId: string) => void;
  accentColor?: string;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node,
  isOpen,
  onClose,
  status,
  checklistStates,
  onToggleChecklist,
  onStatusChange,
  onNavigateToNode,
  accentColor = "#F59E0B",
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !node) return null;

  const totalChecklist = node.checklist.length;
  const completedCount = node.checklist.filter(
    (item) => checklistStates[item.id] ?? item.completed
  ).length;
  const percentComplete =
    totalChecklist > 0 ? Math.round((completedCount / totalChecklist) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-node-title"
      className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch animate-fadeIn"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container (Bottom-sheet on mobile, side-drawer on desktop) */}
      <div className="relative z-10 w-full sm:max-w-xl bg-[#10131d] border-t sm:border-t-0 sm:border-l border-slate-800/90 text-slate-100 shadow-2xl flex flex-col max-h-[90vh] sm:max-h-full h-full rounded-t-2xl sm:rounded-none overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 bg-[#131724]">
          {/* Mobile swipe indicator */}
          <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-3 sm:hidden" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                {node.badge && (
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono"
                    style={{
                      borderColor: `${accentColor}50`,
                      backgroundColor: `${accentColor}10`,
                      color: accentColor,
                    }}
                  >
                    {node.badge}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 bg-slate-800/80 border border-slate-700">
                  {node.level.toUpperCase()}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ~{node.estimatedHours}h
                </span>
              </div>

              <h2 id="drawer-node-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {node.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-900 rounded border border-slate-700 mr-2">
                Esc
              </kbd>
              ✕
            </button>
          </div>

          {/* Status Switcher Bar */}
          <div className="mt-4 pt-3.5 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-400">Node Status:</span>
            <div className="inline-flex rounded-lg bg-[#0c0e15] p-1 border border-slate-800">
              {(["planned", "in-progress", "completed"] as NodeStatus[]).map((st) => {
                const isActive = status === st;
                let activeClass = "text-slate-400 hover:text-slate-200";
                if (isActive) {
                  if (st === "completed") activeClass = "bg-emerald-950/60 text-emerald-300 border border-emerald-700/60 shadow-xs";
                  else if (st === "in-progress") activeClass = "bg-amber-950/60 text-amber-300 border border-amber-700/60 shadow-xs";
                  else activeClass = "bg-slate-800 text-white shadow-xs";
                }

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onStatusChange(node.id, st)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${activeClass}`}
                  >
                    {st === "completed" ? "✓ Done" : st === "in-progress" ? "⚡ Active" : "○ Planned"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Description */}
          <div className="rounded-xl bg-[#0c0f17] border border-slate-800/80 p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
              Overview &amp; Core Purpose
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {node.description}
            </p>
          </div>

          {/* Interactive Checklist */}
          {totalChecklist > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Concepts &amp; Milestones
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Check off items as you learn; updates status automatically.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-300">
                  {completedCount}/{totalChecklist} ({percentComplete}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percentComplete}%`,
                    backgroundColor: percentComplete === 100 ? "#10B981" : "#F59E0B",
                  }}
                />
              </div>

              {/* Items */}
              <div className="space-y-1.5 pt-1">
                {node.checklist.map((item) => {
                  const isChecked = checklistStates[item.id] ?? item.completed;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onToggleChecklist(node.id, item.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                        isChecked
                          ? "bg-emerald-950/15 border-emerald-900/40 text-slate-300"
                          : "bg-[#0c0f17] border-slate-800 hover:border-slate-700 text-slate-200"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center shrink-0 mt-0.5 border transition-all ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "border-slate-700 bg-slate-800"
                        }`}
                      >
                        {isChecked && <span className="text-[10px] font-bold">✓</span>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium ${
                            isChecked ? "text-slate-400 line-through" : "text-slate-200"
                          }`}
                        >
                          {item.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Key Concepts */}
          {node.keyConcepts.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Key Concepts
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {node.keyConcepts.map((concept) => (
                  <span
                    key={concept}
                    className="px-2 py-0.5 rounded bg-[#0c0f17] border border-slate-800 text-[11px] font-mono text-slate-300"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prerequisites */}
          {node.prerequisites.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Prerequisites (Click to inspect)
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {node.prerequisites.map((prereqId) => (
                  <button
                    key={prereqId}
                    type="button"
                    onClick={() => onNavigateToNode && onNavigateToNode(prereqId)}
                    className="px-2.5 py-1 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs font-mono hover:bg-amber-900/40 transition-colors cursor-pointer"
                  >
                    ↑ {prereqId}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resources */}
          {node.resources.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Curated High-Signal Documentation
              </h3>
              <div className="space-y-1.5">
                {node.resources.map((res) => (
                  <a
                    key={res.url}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between p-2.5 rounded-lg bg-[#0c0f17] border border-slate-800 hover:border-slate-700 hover:bg-[#131724] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-mono">[{res.type.toUpperCase()}]</span>
                      <span className="text-xs font-medium text-slate-200 group-hover:text-amber-300 transition-colors">
                        {res.title}
                      </span>
                    </div>
                    <span className="text-slate-500 group-hover:text-amber-400 text-xs font-mono transition-colors">
                      ↗
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#131724] flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[11px] text-slate-500">Cached in localStorage</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

