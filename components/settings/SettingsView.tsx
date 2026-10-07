"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Info,
  Clock,
  Lock,
} from "lucide-react";
import { explainFieldRequest } from "@/lib/privacy/privacyCenter";

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<"memory" | "automation" | "data">("memory");

  // Career Memory State
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [loadingMemory, setLoadingMemory] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState("CORE_SKILL");

  // Automation State
  const [automations, setAutomations] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(true);

  // Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationPhrase, setDeleteConfirmationPhrase] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Feedback & Accessibility
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  const announce = (msg: string) => {
    setLiveAnnouncement(msg);
  };

  useEffect(() => {
    loadMemory();
    loadAutomations();
  }, []);

  const loadMemory = async () => {
    setLoadingMemory(true);
    try {
      const res = await fetch("/api/privacy/memory");
      if (res.ok) {
        const data = await res.json();
        setMemoryItems(data.memory || []);
      }
    } catch (err) {
      console.error("[Settings] Error loading memory:", err);
    } finally {
      setLoadingMemory(false);
    }
  };

  const loadAutomations = async () => {
    setLoadingAutomations(true);
    try {
      const res = await fetch("/api/automation");
      if (res.ok) {
        const data = await res.json();
        setAutomations(data.automations || []);
        setExecutions(data.executions || []);
        setAuditLogs(data.auditLogs || []);
      }
    } catch (err) {
      console.error("[Settings] Error loading automations:", err);
    } finally {
      setLoadingAutomations(false);
    }
  };

  const handleConfirmMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/privacy/memory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      if (res.ok) {
        announce("Memory item confirmed.");
        await loadMemory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/privacy/memory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: "User rejected from Privacy Center" }),
      });
      if (res.ok) {
        announce("Memory item rejected.");
        await loadMemory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/privacy/memory/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        announce("Memory item deleted.");
        await loadMemory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      const res = await fetch("/api/privacy/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCategory,
          key: newKey.trim(),
          value: newValue.trim(),
          provenance: "CONFIRMED",
          confidence: 1.0,
          sourceDescription: "Direct user entry via Privacy Center",
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewKey("");
        setNewValue("");
        announce("New career memory item added.");
        await loadMemory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAutomation = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          automationId: id,
          enabled: !currentEnabled,
        }),
      });
      if (res.ok) {
        announce(`Automation ${!currentEnabled ? "enabled" : "disabled"}.`);
        await loadAutomations();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportData = () => {
    announce("Initiating secure data export...");
    if (typeof window !== "undefined") {
      window.location.href = "/api/privacy/export";
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationPhrase !== "DELETE MY ACCOUNT PERMANENTLY") {
      setDeleteError("You must type 'DELETE MY ACCOUNT PERMANENTLY' exactly.");
      return;
    }

    setDeletingAccount(true);
    setDeleteError("");
    announce("Deleting account and purging all user data...");

    try {
      const res = await fetch("/api/privacy/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationPhrase: deleteConfirmationPhrase,
        }),
      });

      if (res.ok) {
        announce("Account deleted. Redirecting to home page.");
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      } else {
        const data = await res.json();
        setDeleteError(data.message || "Deletion failed.");
        setDeletingAccount(false);
      }
    } catch (err: any) {
      setDeleteError(err?.message || "Deletion failed due to network error.");
      setDeletingAccount(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 font-sans">
      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Top Header */}
      <div className="pb-6 border-b border-ink/8">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="p-1 rounded-md bg-accent/10 border border-accent/20 text-accent">
            <Lock size={16} aria-hidden="true" />
          </span>
          <span className="text-xs font-mono uppercase tracking-widest text-accent font-semibold">
            Trust & Autonomy Architecture
          </span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Privacy Center & Automation Settings
        </h1>
        <p className="text-xs sm:text-sm text-ink/60 mt-1 max-w-2xl">
          Inspect, confirm, or reject career memory items. Configure automation policies and exercise your rights to export or delete your data.
        </p>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Settings Sections" className="flex border-b border-white/10 gap-6 text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "memory"}
          onClick={() => setActiveTab("memory")}
          className={`flex items-center gap-2 py-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "memory"
              ? "border-accent text-accent"
              : "border-transparent text-ink/60 hover:text-white"
          }`}
        >
          <ShieldCheck size={14} aria-hidden="true" />
          <span>Career Memory & Provenance</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] font-mono">
            {memoryItems.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "automation"}
          onClick={() => setActiveTab("automation")}
          className={`flex items-center gap-2 py-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "automation"
              ? "border-accent text-accent"
              : "border-transparent text-ink/60 hover:text-white"
          }`}
        >
          <Cpu size={14} aria-hidden="true" />
          <span>Automation Permissions & Policies</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] font-mono">
            {automations.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "data"}
          onClick={() => setActiveTab("data")}
          className={`flex items-center gap-2 py-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "data"
              ? "border-accent text-accent"
              : "border-transparent text-ink/60 hover:text-white"
          }`}
        >
          <Download size={14} aria-hidden="true" />
          <span>Data Export & Deletion</span>
        </button>
      </div>

      {/* TAB 1: CAREER MEMORY */}
      {activeTab === "memory" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface/50 p-4 rounded-xl border border-white/10">
            <div>
              <h2 className="text-sm font-bold text-white">Authoritative Personal Memory</h2>
              <p className="text-xs text-ink/60 mt-0.5">
                UBIX never assumes facts. Inferred items require your explicit confirmation before being used in applications.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadMemory}
                className="p-2 rounded-lg border border-white/10 bg-surface text-ink/70 hover:text-white transition-colors cursor-pointer"
                aria-label="Refresh memory list"
              >
                <RefreshCw size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-xs font-bold text-bg hover:bg-accent/90 transition-colors cursor-pointer"
              >
                <Plus size={13} aria-hidden="true" />
                <span>Add Career Fact</span>
              </button>
            </div>
          </div>

          {loadingMemory ? (
            <div className="p-12 text-center text-xs text-ink/50">
              Loading your verified career memory...
            </div>
          ) : memoryItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-white/10 bg-surface/20 space-y-2">
              <ShieldCheck size={28} className="mx-auto text-ink/30" aria-hidden="true" />
              <p className="text-sm font-semibold text-white">No memory items recorded yet.</p>
              <p className="text-xs text-ink/50 max-w-md mx-auto">
                Items will appear here as you verify skills, state career preferences, or add verified facts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {memoryItems.map((item) => {
                const explanation = explainFieldRequest(item.key);
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-white/10 bg-surface/40 hover:bg-surface/60 transition-colors space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                          {item.key}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-ink/60">
                          {item.category}
                        </span>
                      </div>

                      {/* Provenance Badge */}
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                          item.provenance === "CONFIRMED"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : item.provenance === "USER_REJECTED"
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        }`}
                      >
                        {item.provenance} ({Math.round(item.confidence * 100)}%)
                      </span>
                    </div>

                    <p className="text-xs text-ink font-medium bg-bg/50 p-2.5 rounded-lg border border-white/5">
                      {item.value}
                    </p>

                    {/* Transparency info */}
                    <div className="text-[11px] text-ink/60 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Info size={11} className="text-accent shrink-0" aria-hidden="true" />
                        <span><strong>Why UBIX uses this:</strong> {explanation.purpose}</span>
                      </div>
                      <p className="pl-4 text-[10px] text-ink/40">
                        Source: {item.sourceDescription || "System inference"} · Recorded {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                      {item.provenance === "INFERRED" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConfirmMemory(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                          >
                            <CheckCircle2 size={11} aria-hidden="true" />
                            <span>Confirm Fact</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectMemory(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
                          >
                            <XCircle size={11} aria-hidden="true" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(item.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-white/10 text-[11px] text-ink/50 hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer"
                        aria-label={`Remove memory item ${item.key}`}
                      >
                        <Trash2 size={11} aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Fact Modal */}
          {showAddModal && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-fact-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            >
              <form
                onSubmit={handleAddMemory}
                className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-elevated p-6 shadow-2xl space-y-4"
              >
                <h3 id="add-fact-title" className="text-base font-bold text-white">
                  Add Career Memory Fact
                </h3>
                <div className="space-y-1">
                  <label htmlFor="memory-category" className="text-xs font-semibold text-ink/70">Category</label>
                  <select
                    id="memory-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-bg p-2 text-xs text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="CORE_SKILL">CORE_SKILL</option>
                    <option value="CAREER_GOAL">CAREER_GOAL</option>
                    <option value="WORK_PREFERENCE">WORK_PREFERENCE</option>
                    <option value="EXPERIENCE">EXPERIENCE</option>
                    <option value="EDUCATION">EDUCATION</option>
                    <option value="CONSTRAINT">CONSTRAINT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="memory-key" className="text-xs font-semibold text-ink/70">Key (e.g. primary_language)</label>
                  <input
                    id="memory-key"
                    type="text"
                    required
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="e.g. preferred_work_style"
                    className="w-full rounded-xl border border-white/10 bg-bg p-2 text-xs text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="memory-value" className="text-xs font-semibold text-ink/70">Value</label>
                  <input
                    id="memory-value"
                    type="text"
                    required
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="e.g. Remote-first asynchronous teams"
                    className="w-full rounded-xl border border-white/10 bg-bg p-2 text-xs text-ink focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-xs text-ink/60 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-accent text-xs font-bold text-bg hover:bg-accent/90"
                  >
                    Save Fact
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUTOMATION PERMISSIONS */}
      {activeTab === "automation" && (
        <div className="space-y-6">
          <div className="bg-surface/50 p-4 rounded-xl border border-white/10">
            <h2 className="text-sm font-bold text-white">Three-Tier Action Authorization Policy</h2>
            <p className="text-xs text-ink/60 mt-0.5">
              UBIX enforces strict isolation. Background tasks can only run safe analytical updates. Outbound applications and destructive changes strictly require human confirmation tokens.
            </p>
          </div>

          {loadingAutomations ? (
            <div className="p-12 text-center text-xs text-ink/50">
              Loading registered automations...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                  <span className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                    Tier 1: SAFE_AUTOMATIC
                  </span>
                  <p className="text-[11px] text-ink/70">
                    Runs automatically. Analyzes roadmaps, detects skill gaps, monitors jobs, and refreshes local metrics. Zero external mutations.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                  <span className="font-mono text-xs font-bold text-amber-300 uppercase tracking-wider block">
                    Tier 2: CONFIRMATION_REQUIRED
                  </span>
                  <p className="text-[11px] text-ink/70">
                    Pauses execution and generates a cryptographic single-use token. Requires your explicit confirmation before applying.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5">
                  <span className="font-mono text-xs font-bold text-rose-400 uppercase tracking-wider block">
                    Tier 3: EXPLICIT_HUMAN_ACTION
                  </span>
                  <p className="text-[11px] text-ink/70">
                    Strictly prohibited from automatic background invocation. Requires manual user interaction from the UI.
                  </p>
                </div>
              </div>

              {/* Registered automations list */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink/70 font-semibold">
                  Configured Automations
                </h3>
                {automations.map((auto) => (
                  <div
                    key={auto.id}
                    className="p-4 rounded-xl border border-white/10 bg-surface/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{auto.name}</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-ink/70">
                          {auto.actionClass}
                        </span>
                      </div>
                      <p className="text-xs text-ink/60">{auto.description}</p>
                      <p className="text-[10px] text-ink/40 font-mono">ID: {auto.id}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAutomation(auto.id, auto.enabled)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          auto.enabled
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                            : "bg-white/5 border border-white/10 text-ink/50 hover:text-white"
                        }`}
                      >
                        {auto.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Executions Audit */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink/70 font-semibold">
                  Execution & Audit Trail
                </h3>
                {executions.length === 0 ? (
                  <p className="text-xs text-ink/40 italic">No historical executions recorded for this account.</p>
                ) : (
                  <div className="space-y-2">
                    {executions.slice(0, 5).map((exec) => (
                      <div
                        key={exec.id}
                        className="p-3 rounded-lg border border-white/5 bg-surface/30 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-white">{exec.automationId}</span>
                          <span className="text-ink/50 text-[11px] ml-2">
                            {new Date(exec.startedAt).toLocaleString()}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
                            exec.state === "COMPLETED"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : exec.state === "WAITING_FOR_CONFIRMATION"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                              : "bg-white/5 border-white/10 text-ink/60"
                          }`}
                        >
                          {exec.state}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DATA EXPORT & DELETION */}
      {activeTab === "data" && (
        <div className="space-y-6">
          {/* Data Export Box */}
          <div className="p-6 rounded-2xl border border-white/10 bg-surface/40 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Export My UBIX Data</h2>
              <p className="text-xs text-ink/60 mt-1 max-w-xl">
                Download a complete, machine-readable JSON archive of your personal career memory, verified evidence wallet, tracked applications, and resume assessments.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportData}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-xs font-bold text-bg hover:bg-accent/90 transition-colors cursor-pointer"
              >
                <Download size={13} aria-hidden="true" />
                <span>Export Career Archive (.json)</span>
              </button>
            </div>
          </div>

          {/* Account Deletion Box */}
          <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle size={18} aria-hidden="true" />
              <h2 className="text-base font-bold">Delete My Account</h2>
            </div>

            <p className="text-xs text-ink/70 leading-relaxed max-w-xl">
              Permanently purges all verified skills, career memory, resume analyses, and application logs. This operation is irreversible and cannot be undone.
            </p>

            <button
              type="button"
              onClick={() => { setShowDeleteModal(true); setDeleteError(""); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/15 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>Initiate Account Deletion</span>
            </button>
          </div>

          {/* Destructive Deletion Confirmation Modal */}
          {showDeleteModal && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            >
              <div className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-surface-elevated p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle size={20} aria-hidden="true" />
                  <h3 id="delete-dialog-title" className="text-base font-bold text-white">
                    Confirm Permanent Account Deletion
                  </h3>
                </div>

                <div className="text-xs text-ink/80 space-y-2 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                  <p className="font-semibold text-rose-300">This action is permanent and completely irreversible.</p>
                  <ul className="list-disc list-inside space-y-0.5 text-ink/70 text-[11px]">
                    <li>Purges personal profile and authenticated credentials</li>
                    <li>Deletes all uploaded resumes and parsed documents</li>
                    <li>Destroys all verified Skill Evidence Wallet entries</li>
                    <li>Wipes Personal Career Memory provenance facts</li>
                    <li>Invalidates all active session tokens immediately</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm-delete-input" className="text-xs font-semibold text-ink/80 block">
                    Type <code className="font-mono text-rose-300 bg-rose-950/40 px-1 py-0.5 rounded">DELETE MY ACCOUNT PERMANENTLY</code> to confirm:
                  </label>
                  <input
                    id="confirm-delete-input"
                    type="text"
                    value={deleteConfirmationPhrase}
                    onChange={(e) => setDeleteConfirmationPhrase(e.target.value)}
                    placeholder="DELETE MY ACCOUNT PERMANENTLY"
                    className="w-full rounded-xl border border-rose-500/30 bg-bg p-3 text-xs text-ink font-mono focus:border-rose-400 focus:outline-none"
                  />
                  {deleteError && (
                    <p role="alert" className="text-xs text-rose-400 font-medium">{deleteError}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowDeleteModal(false); setDeleteConfirmationPhrase(""); }}
                    disabled={deletingAccount}
                    className="px-4 py-2 text-xs font-semibold text-ink/60 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount || deleteConfirmationPhrase !== "DELETE MY ACCOUNT PERMANENTLY"}
                    className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {deletingAccount ? "Deleting Account..." : "Permanently Delete Account"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
