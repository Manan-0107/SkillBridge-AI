"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Award,
  Layers,
  FileText,
  Code2,
  GitFork,
  BookOpen,
  Activity,
  User,
} from "lucide-react";
import type { SkillEvidenceItem, EvidenceSourceType, EvidenceStatus } from "@/lib/career/evidenceWallet";

export function EvidenceWallet() {
  const [evidenceItems, setEvidenceItems] = useState<SkillEvidenceItem[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Add Evidence Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [source, setSource] = useState<EvidenceSourceType>("USER_CONFIRMATION");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [confidence, setConfidence] = useState(0.85);

  // Live accessibility announcement
  const [announcement, setAnnouncement] = useState("");

  const announce = (msg: string) => {
    setAnnouncement(msg);
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  const loadEvidence = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/career/evidence");
      if (res.ok) {
        const data = await res.json();
        setEvidenceItems(data.evidence || []);
        setVerifiedSkills(data.verifiedSkills || []);
      }
    } catch (err) {
      console.error("[EvidenceWallet] Error loading evidence:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const res = await fetch(`/api/career/evidence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      if (res.ok) {
        announce("Evidence item confirmed.");
        await loadEvidence();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/career/evidence/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: "User rejected evidence." }),
      });
      if (res.ok) {
        announce("Evidence item rejected.");
        await loadEvidence();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/career/evidence/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        announce("Evidence item deleted.");
        await loadEvidence();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim() || !title.trim()) return;

    try {
      const res = await fetch("/api/career/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName: skillName.trim(),
          source,
          status: "CONFIRMED",
          confidence,
          title: title.trim(),
          description: description.trim(),
          artifactUrl: artifactUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setSkillName("");
        setTitle("");
        setDescription("");
        setArtifactUrl("");
        announce("Skill evidence successfully recorded.");
        await loadEvidence();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = evidenceItems.filter((item) => {
    if (filterSource !== "ALL" && item.source !== filterSource) return false;
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    return true;
  });

  const getSourceIcon = (src: EvidenceSourceType) => {
    switch (src) {
      case "RESUME_PARSED":
        return <FileText size={13} className="text-blue-400" aria-hidden="true" />;
      case "PROJECT_COMPLETED":
        return <Code2 size={13} className="text-emerald-400" aria-hidden="true" />;
      case "GITHUB_REPOSITORY":
        return <GitFork size={13} className="text-purple-400" aria-hidden="true" />;
      case "PRACTICE_ASSESSMENT":
        return <Activity size={13} className="text-amber-400" aria-hidden="true" />;
      case "WORK_EXPERIENCE":
        return <Award size={13} className="text-teal-400" aria-hidden="true" />;
      default:
        return <User size={13} className="text-accent" aria-hidden="true" />;
    }
  };

  return (
    <div className="space-y-6">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-surface/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-accent" aria-hidden="true" />
            <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              Verifiable Evidence Wallet
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            Authoritative Skill Proof & Artifacts
          </h2>
          <p className="text-xs text-ink/60 mt-0.5">
            Every skill claim is backed by tangible proof: uploaded code, parsed employment history, or benchmark assessments.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadEvidence}
            aria-label="Refresh evidence list"
            className="p-2 rounded-xl border border-white/10 bg-surface text-ink/70 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-xs font-bold text-bg hover:bg-accent/90 transition-colors cursor-pointer"
          >
            <Plus size={13} aria-hidden="true" />
            <span>Add Skill Evidence</span>
          </button>
        </div>
      </div>

      {/* Verified Skills Summary Banner */}
      {verifiedSkills.length > 0 && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
            Confirmed Skills Composite ({verifiedSkills.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {verifiedSkills.map((s) => (
              <span
                key={s.skillId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-emerald-500/30 text-xs font-semibold text-emerald-300"
              >
                <span>{s.skillName}</span>
                <span className="text-[10px] font-mono px-1 rounded bg-emerald-950/40 text-emerald-400">
                  {Math.round(s.confidence * 100)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-ink/50 font-mono text-[11px]">Source:</span>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-ink focus:border-accent focus:outline-none cursor-pointer"
            aria-label="Filter evidence by source"
          >
            <option value="ALL">All Sources</option>
            <option value="USER_CONFIRMATION">User Confirmation</option>
            <option value="RESUME_PARSED">Resume Parsed</option>
            <option value="PROJECT_COMPLETED">Project Completed</option>
            <option value="GITHUB_REPOSITORY">GitHub Repository</option>
            <option value="PRACTICE_ASSESSMENT">Practice Assessment</option>
            <option value="WORK_EXPERIENCE">Work Experience</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-ink/50 font-mono text-[11px]">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-ink focus:border-accent focus:outline-none cursor-pointer"
            aria-label="Filter evidence by verification status"
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="INFERRED">INFERRED</option>
            <option value="USER_REJECTED">USER_REJECTED</option>
          </select>
        </div>
      </div>

      {/* Evidence Items Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-ink/50">
          Loading Skill Evidence Wallet...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-white/10 bg-surface/20 space-y-2">
          <ShieldCheck size={28} className="mx-auto text-ink/30" aria-hidden="true" />
          <p className="text-sm font-semibold text-white">No skill evidence has been added yet.</p>
          <p className="text-xs text-ink/50 max-w-md mx-auto">
            Upload your resume, complete an interactive practice drill, or add a portfolio artifact to build verifiable skill proof.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl border border-white/10 bg-surface/40 hover:bg-surface/60 transition-colors space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-surface border border-white/10">
                      {getSourceIcon(item.source)}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white">{item.skillName}</h3>
                      <span className="text-[10px] font-mono text-ink/50">{item.source}</span>
                    </div>
                  </div>

                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      item.status === "CONFIRMED"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : item.status === "USER_REJECTED"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    }`}
                  >
                    {item.status} ({Math.round(item.confidence * 100)}%)
                  </span>
                </div>

                <div className="bg-bg/60 p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-xs font-semibold text-white block">{item.title}</span>
                  {item.description && (
                    <p className="text-xs text-ink/70 leading-relaxed">{item.description}</p>
                  )}
                  {item.artifactUrl && (
                    <a
                      href={item.artifactUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline pt-1"
                    >
                      <span>View Artifact</span>
                      <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  )}
                </div>

                <div className="text-[10px] font-mono text-ink/40">
                  Recorded: {new Date(item.createdAt).toLocaleDateString()}
                  {item.verifiedAt && ` · Verified: ${new Date(item.verifiedAt).toLocaleDateString()}`}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                {item.status !== "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={() => handleConfirm(item.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={11} aria-hidden="true" />
                    <span>Verify Proof</span>
                  </button>
                )}

                {item.status !== "USER_REJECTED" && (
                  <button
                    type="button"
                    onClick={() => handleReject(item.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer"
                  >
                    <XCircle size={11} aria-hidden="true" />
                    <span>Reject</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  aria-label={`Delete evidence for ${item.skillName}`}
                  className="p-1 rounded-lg border border-white/10 text-ink/40 hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Evidence Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-evidence-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <form
            onSubmit={handleAddEvidence}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface-elevated p-6 shadow-2xl space-y-4 my-8"
          >
            <h3 id="add-evidence-dialog-title" className="text-base font-bold text-white">
              Add Verifiable Skill Evidence
            </h3>

            <div className="space-y-1">
              <label htmlFor="ev-skill-name" className="text-xs font-semibold text-ink/70">Skill Name</label>
              <input
                id="ev-skill-name"
                type="text"
                required
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="e.g. TypeScript, PostgreSQL, Docker"
                className="w-full rounded-xl border border-white/10 bg-bg p-2.5 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="ev-source" className="text-xs font-semibold text-ink/70">Evidence Source</label>
                <select
                  id="ev-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-bg p-2.5 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  <option value="USER_CONFIRMATION">USER_CONFIRMATION</option>
                  <option value="PROJECT_COMPLETED">PROJECT_COMPLETED</option>
                  <option value="RESUME_PARSED">RESUME_PARSED</option>
                  <option value="GITHUB_REPOSITORY">GITHUB_REPOSITORY</option>
                  <option value="PRACTICE_ASSESSMENT">PRACTICE_ASSESSMENT</option>
                  <option value="WORK_EXPERIENCE">WORK_EXPERIENCE</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="ev-confidence" className="text-xs font-semibold text-ink/70">Confidence Score (0.1 - 1.0)</label>
                <input
                  id="ev-confidence"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1.0"
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-bg p-2.5 text-xs text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="ev-title" className="text-xs font-semibold text-ink/70">Evidence Title / Artifact</label>
              <input
                id="ev-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Telemetry Pipeline in Node.js"
                className="w-full rounded-xl border border-white/10 bg-bg p-2.5 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="ev-desc" className="text-xs font-semibold text-ink/70">Description & Context</label>
              <textarea
                id="ev-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detail the technical implementation, constraints, and measurable results..."
                className="w-full rounded-xl border border-white/10 bg-bg p-2.5 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="ev-artifact-url" className="text-xs font-semibold text-ink/70">Artifact URL (Optional)</label>
              <input
                id="ev-artifact-url"
                type="url"
                value={artifactUrl}
                onChange={(e) => setArtifactUrl(e.target.value)}
                placeholder="https://github.com/... or verified certificate"
                className="w-full rounded-xl border border-white/10 bg-bg p-2.5 text-xs text-ink focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-2 text-xs text-ink/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-accent text-xs font-bold text-bg hover:bg-accent/90"
              >
                Save Evidence
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
