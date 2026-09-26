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
  accentColor = "var(--color-accent)",
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
        className="fixed inset-0 bg-ink/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container (Slide-over on desktop, bottom-sheet on mobile) */}
      <div className="relative z-10 w-full sm:max-w-2xl bg-surface border-t sm:border-t-0 sm:border-l border-ink/15 text-ink shadow-2xl flex flex-col max-h-[90vh] sm:max-h-full h-full rounded-t-2xl sm:rounded-none overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-ink/10 bg-bg">
          {/* Mobile swipe indicator */}
          <div className="w-10 h-1 rounded-full bg-ink/20 mx-auto mb-3 sm:hidden" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                {node.badge && (
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono border-accent/25 bg-accent/10 text-accent"
                  >
                    {node.badge}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono text-ink/75 bg-surface border border-ink/15">
                  {node.level.toUpperCase()}
                </span>
                <span className="text-[11px] text-ink/60 font-mono">
                  ~{node.estimatedHours}h
                </span>
              </div>

              <h2 id="drawer-node-title" className="text-lg sm:text-xl font-bold text-ink tracking-tight">
                {node.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink/60 hover:text-ink hover:bg-surface border border-ink/15 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-ink/50 bg-bg rounded border border-ink/15 mr-2">
                Esc
              </kbd>
              ✕
            </button>
          </div>

          {/* Quick Status Selector Bar */}
          <div className="mt-4 pt-3.5 border-t border-ink/10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink/70">Node Status:</span>
            <div className="inline-flex rounded-lg bg-surface p-1 border border-ink/15">
              {(["planned", "in-progress", "completed"] as NodeStatus[]).map((st) => {
                const isActive = status === st;
                let activeClass = "text-ink/65 hover:text-ink";
                if (isActive) {
                  if (st === "completed") activeClass = "bg-success text-white shadow-xs font-semibold";
                  else if (st === "in-progress") activeClass = "bg-accent text-white shadow-xs font-semibold";
                  else activeClass = "bg-bg text-ink border border-ink/15 font-semibold shadow-xs";
                }

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onStatusChange(node.id, st)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${activeClass}`}
                  >
                    {st === "completed" ? "✓ Done" : st === "in-progress" ? "Active" : "Planned"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Tabs within Drawer */}
          <div className="flex items-center gap-2 mt-4 pt-2 overflow-x-auto no-scrollbar border-t border-ink/10">
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
                    ? "bg-accent text-white font-semibold shadow-xs"
                    : "text-ink/70 hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-surface text-ink">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* Why It Matters Callout */}
              {node.whyItMatters && (
                <div className="rounded-xl bg-accent/10 border border-accent/25 p-3.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-accent font-mono mb-1">
                    Why This Topic Matters in Production
                  </h4>
                  <p className="text-xs text-ink/80 leading-relaxed">
                    {node.whyItMatters}
                  </p>
                </div>
              )}

              {/* Description */}
              <div className="rounded-xl bg-bg border border-ink/15 p-4">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink/60 font-mono mb-1.5">
                  Concept Deep Dive
                </h4>
                <p className="text-xs sm:text-sm text-ink leading-relaxed">
                  {node.description}
                </p>
              </div>

              {/* Key Concepts */}
              {node.keyConcepts && node.keyConcepts.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink/60 font-mono mb-2">
                    Core Engineering Concepts
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {node.keyConcepts.map((concept) => (
                      <span
                        key={concept}
                        className="px-2.5 py-1 rounded bg-bg border border-ink/15 text-[11px] font-mono text-ink"
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
                <div className="rounded-xl bg-bg border border-ink/15 p-3.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink/60 font-mono mb-2">
                    Prerequisites (Required)
                  </h4>
                  {node.prerequisites && node.prerequisites.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {node.prerequisites.map((pId) => (
                        <button
                          key={pId}
                          type="button"
                          onClick={() => onNavigateToNode && onNavigateToNode(pId)}
                          className="px-2.5 py-1 rounded bg-accent/10 border border-accent/25 text-accent text-xs font-mono hover:bg-accent/20 transition-colors cursor-pointer"
                        >
                          ↑ {pId}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink/50">None · Foundational Topic</p>
                  )}
                </div>

                {/* Unlocks / Next steps */}
                <div className="rounded-xl bg-bg border border-ink/15 p-3.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-ink/60 font-mono mb-2">
                    Unlocks / Next Topics
                  </h4>
                  {node.childrenIds && node.childrenIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {node.childrenIds.map((cId) => (
                        <button
                          key={cId}
                          type="button"
                          onClick={() => onNavigateToNode && onNavigateToNode(cId)}
                          className="px-2.5 py-1 rounded bg-info/10 border border-info/25 text-info text-xs font-mono hover:bg-info/20 transition-colors cursor-pointer"
                        >
                          ↓ {cId}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink/50">Advanced Milestone Endpoint</p>
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink/80 font-mono">
                    Concepts &amp; Subtopics Checklist
                  </h3>
                  <p className="text-[11px] text-ink/60">
                    Check off items as you learn; updates progress percentage automatically.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold text-ink">
                  {completedCount}/{totalChecklist} ({percentComplete}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full rounded-full bg-ink/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percentComplete}%`,
                    backgroundColor: percentComplete === 100 ? "var(--color-success)" : "var(--color-accent)",
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
                          ? "bg-success/10 border-success/25 text-ink"
                          : "bg-bg border-ink/15 hover:border-ink/30 text-ink"
                      }`}
                    >
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center shrink-0 mt-0.5 border transition-all ${
                          isChecked
                            ? "bg-success border-success text-white"
                            : "border-ink/25 bg-surface"
                        }`}
                      >
                        {isChecked && <span className="text-[10px] font-bold">✓</span>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs sm:text-sm font-medium ${
                            isChecked ? "text-ink/60 line-through" : "text-ink"
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.summary && (
                          <p className="text-[11px] text-ink/60 mt-0.5">{item.summary}</p>
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/80 font-mono">
                  Curated Technical Documentation &amp; Guides
                </h3>
                <p className="text-[11px] text-ink/60">
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
                      className="group flex items-center justify-between p-3 rounded-xl bg-bg border border-ink/15 hover:border-accent hover:bg-surface transition-all text-ink"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-ink/50 font-mono">
                          [{res.type.toUpperCase()}]
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-medium text-ink group-hover:text-accent transition-colors">
                            {res.title}
                          </h4>
                          {res.provider && (
                            <span className="text-[10px] text-ink/60 font-mono">
                              By {res.provider}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-ink/40 group-hover:text-accent text-xs font-mono transition-colors">
                        ↗
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink/50">No resources linked for this topic.</p>
              )}
            </div>
          )}

          {/* TAB 4: REAL-WORLD PROJECTS */}
          {activeTab === "projects" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/80 font-mono">
                  Hands-On Projects to Prove Mastery
                </h3>
                <p className="text-[11px] text-ink/60">
                  Build production-grade applications using these skills.
                </p>
              </div>

              {node.projects && node.projects.length > 0 ? (
                <div className="space-y-3">
                  {node.projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="rounded-xl bg-bg border border-ink/15 p-4 space-y-2 text-ink"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-ink">
                          {proj.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono capitalize bg-accent/10 text-accent border border-accent/25">
                          {proj.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-ink/70 leading-relaxed">
                        {proj.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {proj.skills.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded bg-surface border border-ink/15 text-[10px] font-mono text-ink"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-bg border border-ink/15 p-4 text-center">
                  <p className="text-xs text-ink/60">
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink/80 font-mono">
                  Personal Study Notes &amp; Code Snippets
                </h3>
                <p className="text-[11px] text-ink/60">
                  Saved automatically in your browser localStorage.
                </p>
              </div>
              <textarea
                value={personalNotes}
                onChange={(e) => saveNotes(e.target.value)}
                placeholder="Write your study notes, commands, gotchas, or interview takeaways here..."
                rows={10}
                className="w-full rounded-xl bg-bg border border-ink/15 p-3.5 text-xs sm:text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-mono leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-ink/10 bg-bg flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {status !== "completed" ? (
              <button
                type="button"
                onClick={() => onStatusChange(node.id, "completed")}
                className="px-3.5 py-1.5 rounded-lg bg-success hover:brightness-105 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                ✓ Mark Completed
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onStatusChange(node.id, "in-progress")}
                className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-bg border border-ink/15 text-ink text-xs transition-colors cursor-pointer"
              >
                Reopen Topic
              </button>
            )}

            {status !== "in-progress" && status !== "completed" && (
              <button
                type="button"
                onClick={() => onStatusChange(node.id, "in-progress")}
                className="px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-soft text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Start Learning
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface hover:bg-bg border border-ink/15 text-ink font-medium text-xs transition-colors cursor-pointer"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
