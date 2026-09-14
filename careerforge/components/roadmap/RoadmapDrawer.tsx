"use client";

import React, { useState, useEffect } from "react";
import { RoadmapNode, NodeStatus } from "@/types/roadmapTree";

interface RoadmapDrawerProps {
  node: RoadmapNode | null;
  isOpen: boolean;
  onClose: () => void;
  status: NodeStatus;
  checklistStates: Record<string, boolean>;
  onStatusChange: (nodeId: string, status: NodeStatus) => void;
  onChecklistToggle: (nodeId: string, checklistItemId: string) => void;
  onNavigateToNode?: (nodeId: string) => void;
  accentColor?: string;
}

export const RoadmapDrawer: React.FC<RoadmapDrawerProps> = ({
  node,
  isOpen,
  onClose,
  status,
  checklistStates,
  onStatusChange,
  onChecklistToggle,
  onNavigateToNode,
  accentColor = "#F59E0B",
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "checklist" | "resources" | "projects" | "notes">("overview");
  const [personalNotes, setPersonalNotes] = useState<string>("");

  // Load saved personal notes from localStorage
  useEffect(() => {
    if (!node) return;
    try {
      const saved = localStorage.getItem(`careerforge.roadmap_note.${node.id}`);
      setPersonalNotes(saved || "");
    } catch {
      setPersonalNotes("");
    }
  }, [node]);

  const saveNotes = (val: string) => {
    setPersonalNotes(val);
    if (!node) return;
    try {
      localStorage.setItem(`careerforge.roadmap_note.${node.id}`, val);
    } catch {
      // ignore
    }
  };

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

      {/* Drawer Container (Slide-over on desktop, bottom-sheet on mobile) */}
      <div className="relative z-10 w-full sm:max-w-2xl bg-[#10131d] border-t sm:border-t-0 sm:border-l border-slate-800/90 text-slate-100 shadow-2xl flex flex-col max-h-[90vh] sm:max-h-full h-full rounded-t-2xl sm:rounded-none overflow-hidden">
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
                  ⏱ ~{node.estimatedHours}h
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

          {/* Quick Status Selector Bar */}
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

          {/* Navigation Tabs within Drawer */}
          <div className="flex items-center gap-2 mt-4 pt-2 overflow-x-auto no-scrollbar border-t border-slate-800/50">
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "checklist", label: `Subtopics (${completedCount}/${totalChecklist})` },
                { id: "resources", label: `Resources (${node.resources?.length || 0})` },
                { id: "projects", label: `Projects (${node.projects?.length || 0})` },
                { id: "notes", label: "Notes" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === t.id
                    ? "bg-slate-800 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Why It Matters Callout */}
              {node.whyItMatters && (
                <div className="rounded-xl bg-amber-950/20 border border-amber-800/40 p-3.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono mb-1">
                    💡 Why This Topic Matters in Production
                  </h4>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {node.whyItMatters}
                  </p>
                </div>
              )}

              {/* Description */}
              <div className="rounded-xl bg-[#0c0f17] border border-slate-800/80 p-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                  Concept Deep Dive
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {node.description}
                </p>
              </div>

              {/* Key Concepts */}
              {node.keyConcepts && node.keyConcepts.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Core Engineering Concepts
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {node.keyConcepts.map((concept) => (
                      <span
                        key={concept}
                        className="px-2.5 py-1 rounded bg-[#0c0f17] border border-slate-800 text-[11px] font-mono text-slate-300"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites & Successors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Prerequisites */}
                <div className="rounded-xl bg-[#0c0f17] border border-slate-800/80 p-3.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Prerequisites (Required)
                  </h4>
                  {node.prerequisites && node.prerequisites.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {node.prerequisites.map((pId) => (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => onNavigateToNode && onNavigateToNode(pId)}
                          className="px-2.5 py-1 rounded bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs font-mono hover:bg-amber-900/40 transition-colors cursor-pointer"
                        >
                          ↑ {pId}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">None · Foundational Topic</p>
                  )}
                </div>

                {/* Unlocks / Next steps */}
                <div className="rounded-xl bg-[#0c0f17] border border-slate-800/80 p-3.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Unlocks / Next Topics
                  </h4>
                  {node.childrenIds && node.childrenIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {node.childrenIds.map((cId) => (
                        <button
                          key={cId}
                          type="button"
                          onClick={() => onNavigateToNode && onNavigateToNode(cId)}
                          className="px-2.5 py-1 rounded bg-indigo-950/30 border border-indigo-800/50 text-indigo-300 text-xs font-mono hover:bg-indigo-900/40 transition-colors cursor-pointer"
                        >
                          ↓ {cId}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">Advanced Milestone Endpoint</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SUBTOPICS & CHECKLIST */}
          {activeTab === "checklist" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Concepts &amp; Subtopics Checklist
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Check off items as you learn; updates progress percentage automatically.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-300">
                  {completedCount}/{totalChecklist} ({percentComplete}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percentComplete}%`,
                    backgroundColor: percentComplete === 100 ? "#10B981" : "#F59E0B",
                  }}
                />
              </div>

              {/* Items */}
              <div className="space-y-2 pt-1">
                {node.checklist.map((item) => {
                  const isChecked = checklistStates[item.id] ?? item.completed;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onChecklistToggle(node.id, item.id)}
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
                          className={`text-xs sm:text-sm font-medium ${
                            isChecked ? "text-slate-400 line-through" : "text-slate-200"
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.summary && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.summary}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CURATED RESOURCES */}
          {activeTab === "resources" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Curated Technical Documentation &amp; Guides
                </h3>
                <p className="text-[11px] text-slate-500">
                  Official specifications, authoritative books, and verified tutorials.
                </p>
              </div>

              {node.resources && node.resources.length > 0 ? (
                <div className="space-y-2">
                  {node.resources.map((res) => (
                    <a
                      key={res.url}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between p-3 rounded-xl bg-[#0c0f17] border border-slate-800 hover:border-slate-700 hover:bg-[#131724] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-mono">
                          [{res.type.toUpperCase()}]
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-medium text-slate-200 group-hover:text-amber-300 transition-colors">
                            {res.title}
                          </h4>
                          {res.provider && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              By {res.provider}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-slate-500 group-hover:text-amber-400 text-xs font-mono transition-colors">
                        ↗
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No resources linked for this topic.</p>
              )}
            </div>
          )}

          {/* TAB 4: REAL-WORLD PROJECTS */}
          {activeTab === "projects" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Hands-On Projects to Prove Mastery
                </h3>
                <p className="text-[11px] text-slate-500">
                  Build production-grade applications using these skills.
                </p>
              </div>

              {node.projects && node.projects.length > 0 ? (
                <div className="space-y-3">
                  {node.projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="rounded-xl bg-[#0c0f17] border border-slate-800/90 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-100">
                          {proj.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono capitalize bg-amber-950/40 text-amber-300 border border-amber-800/40">
                          {proj.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {proj.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {proj.skills.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/50 text-[10px] font-mono text-slate-300"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-[#0c0f17] border border-slate-800 p-4 text-center">
                  <p className="text-xs text-slate-400">
                    Apply this topic by building end-to-end applications or integrating with the CareerForge workspace assistant.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PERSONAL ENGINEERING NOTES */}
          {activeTab === "notes" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Personal Study Notes &amp; Code Snippets
                </h3>
                <p className="text-[11px] text-slate-500">
                  Saved automatically in your browser localStorage.
                </p>
              </div>
              <textarea
                value={personalNotes}
                onChange={(e) => saveNotes(e.target.value)}
                placeholder="Write your study notes, commands, gotchas, or interview takeaways here..."
                rows={10}
                className="w-full rounded-xl bg-[#0c0f17] border border-slate-800 p-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all font-mono leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800/80 bg-[#131724] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {status !== "completed" ? (
              <button
                type="button"
                onClick={() => onStatusChange(node.id, "completed")}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                ✓ Mark Completed
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStatusChange(node.id, "in-progress")}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
              >
                Reopen Topic
              </button>
            )}

            {status !== "in-progress" && status !== "completed" && (
              <button
                type="button"
                onClick={() => onStatusChange(node.id, "in-progress")}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                ⚡ Start Learning
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
