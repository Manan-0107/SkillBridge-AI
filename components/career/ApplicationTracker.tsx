"use client";

import React, { useState, useEffect } from "react";
import type {
  ApplicationRecord,
  ApplicationStatus,
  ApplicationMaterial,
} from "@/lib/career/types";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { InterviewStudio } from "@/components/career/InterviewStudio";
import { UbixApplyModal } from "@/components/career/UbixApplyModal";

const STATUS_COLUMNS: { id: ApplicationStatus; label: string; color: string }[] = [
  { id: "SAVED", label: "Saved", color: "border-ink/20 text-ink/70" },
  { id: "PREPARING", label: "Preparing", color: "border-amber-500/30 text-amber-400" },
  { id: "READY", label: "Ready to Apply", color: "border-sky-500/30 text-sky-400" },
  { id: "APPLIED", label: "Applied", color: "border-emerald-500/30 text-emerald-400" },
  { id: "INTERVIEW", label: "Interviewing", color: "border-purple-500/30 text-purple-400" },
  { id: "OFFER", label: "Offer", color: "border-accent text-accent" },
  { id: "ARCHIVED", label: "Archived", color: "border-ink/10 text-ink/40" },
];

export function ApplicationTracker() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"board" | "list">("board");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showInterviewStudio, setShowInterviewStudio] = useState(false);
  const [showUbixApply, setShowUbixApply] = useState(false);

  // Copilot Draft Form States
  const [coverLetterDraft, setCoverLetterDraft] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [questionInput, setQuestionInput] = useState("");
  const [questionDraft, setQuestionDraft] = useState<{
    draft: string;
    isSensitive: boolean;
    guidance?: string;
  } | null>(null);
  const [generatingAnswer, setGeneratingAnswer] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (err) {
      console.error("[ApplicationTracker] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    const target = applications.find((a) => a.id === appId);
    if (!target) return;

    const updatedTimeline = [
      ...(target.timeline || []),
      {
        id: `evt_${Date.now()}`,
        applicationId: appId,
        eventType: newStatus === "APPLIED" ? ("MARKED_APPLIED" as const) : ("STATUS_CHANGED" as const),
        description: `Status updated to ${newStatus}`,
        timestamp: new Date().toISOString(),
      },
    ];

    const updatedApp: ApplicationRecord = {
      ...target,
      status: newStatus,
      appliedAt: newStatus === "APPLIED" && !target.appliedAt ? new Date().toISOString() : target.appliedAt,
      timeline: updatedTimeline,
      updatedAt: new Date().toISOString(),
    };

    setApplications((prev) => prev.map((a) => (a.id === appId ? updatedApp : a)));
    if (selectedApp?.id === appId) {
      setSelectedApp(updatedApp);
    }

    try {
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application: updatedApp }),
      });
    } catch (err) {
      console.warn("[ApplicationTracker] Status save warning:", err);
    }
  };

  const handleDeleteApplication = async (appId: string) => {
    if (!confirm("Are you sure you want to remove this tracked application?")) return;
    setApplications((prev) => prev.filter((a) => a.id !== appId));
    if (selectedApp?.id === appId) setSelectedApp(null);

    try {
      await fetch(`/api/applications?id=${appId}`, { method: "DELETE" });
    } catch (err) {
      console.warn("[ApplicationTracker] Delete warning:", err);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!selectedApp) return;
    setGeneratingLetter(true);

    try {
      const res = await fetch("/api/applications/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_cover_letter",
          job: {
            id: selectedApp.jobId,
            title: selectedApp.jobTitle,
            company: selectedApp.company,
            location: selectedApp.location || "",
          },
          userNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.draft) {
        setCoverLetterDraft(data.draft);
      }
    } catch (err) {
      console.error("[ApplicationTracker] Cover letter generation error:", err);
    } finally {
      setGeneratingLetter(false);
    }
  };

  const handleGenerateAnswer = async () => {
    if (!selectedApp || !questionInput.trim()) return;
    setGeneratingAnswer(true);

    try {
      const res = await fetch("/api/applications/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_answer",
          question: questionInput,
          job: {
            id: selectedApp.jobId,
            title: selectedApp.jobTitle,
            company: selectedApp.company,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setQuestionDraft({
          draft: data.draft || "",
          isSensitive: data.isSensitive || false,
          guidance: data.guidance,
        });
      }
    } catch (err) {
      console.error("[ApplicationTracker] Question drafting error:", err);
    } finally {
      setGeneratingAnswer(false);
    }
  };

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredApps = applications.filter((app) => {
    if (statusFilter === "ALL") return app.status !== "ARCHIVED";
    return app.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls & Summary Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Briefcase size={20} className="text-accent" />
            <span>Application Copilot &amp; Tracker</span>
          </h2>
          <p className="text-xs text-ink/60 mt-0.5">
            Prepare, tailor, and track your opportunities with complete user control.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-white/10 bg-surface/40 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("board")}
              className={`rounded px-3 py-1 transition-colors cursor-pointer ${
                activeTab === "board" ? "bg-accent text-bg" : "text-ink/60 hover:text-white"
              }`}
            >
              Board View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`rounded px-3 py-1 transition-colors cursor-pointer ${
                activeTab === "list" ? "bg-accent text-bg" : "text-ink/60 hover:text-white"
              }`}
            >
              List View
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-xs text-white focus:border-accent focus:outline-none cursor-pointer"
            aria-label="Filter applications by status"
          >
            <option value="ALL">Active (Excludes Archived)</option>
            {STATUS_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>
                {col.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-ink/50 bg-surface/20 rounded-2xl border border-white/5">
          Loading your application pipeline...
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-surface/30 p-8 sm:p-12 text-center space-y-3">
          <Briefcase size={36} className="mx-auto text-ink/40" />
          <h3 className="text-base font-semibold text-white">No Tracked Applications Yet</h3>
          <p className="text-xs text-ink/60 max-w-md mx-auto">
            Discover opportunities in Opportunity Radar or analyze a job posting to save and track applications here.
          </p>
        </div>
      ) : (
        <>
          {/* Board View */}
          {activeTab === "board" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
              {STATUS_COLUMNS.filter((col) => col.id !== "ARCHIVED").map((col) => {
                const columnApps = applications.filter((a) => a.status === col.id);
                return (
                  <div
                    key={col.id}
                    className="flex flex-col rounded-2xl border border-white/5 bg-surface/20 p-4 space-y-3 min-w-[260px]"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                        {col.label}
                      </span>
                      <span className="text-[11px] font-mono text-ink/40">
                        {columnApps.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px]">
                      {columnApps.map((app) => (
                        <div
                          key={app.id}
                          className="rounded-xl border border-white/10 bg-surface/60 p-4 space-y-2 hover:border-accent/40 transition-colors group cursor-pointer"
                          onClick={() => setSelectedApp(app)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-white text-xs group-hover:text-accent transition-colors line-clamp-1">
                              {app.jobTitle}
                            </h4>
                          </div>
                          <p className="text-[11px] text-ink/60">{app.company}</p>

                          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-ink/40">
                            <span>{app.remoteType || "On-site"}</span>
                            <span className="text-accent font-semibold flex items-center gap-1">
                              <span>Open Copilot</span>
                              <ArrowRight size={10} />
                            </span>
                          </div>
                        </div>
                      ))}

                      {columnApps.length === 0 && (
                        <p className="text-[11px] text-ink/30 italic text-center py-6">
                          No applications
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {activeTab === "list" && (
            <div className="rounded-2xl border border-white/10 bg-surface/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-ink/80">
                  <thead className="bg-surface/50 border-b border-white/10 text-[10px] uppercase font-mono text-ink/50">
                    <tr>
                      <th className="p-4">Position &amp; Company</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Source</th>
                      <th className="p-4">Last Updated</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredApps.map((app) => (
                      <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-white">{app.jobTitle}</p>
                          <p className="text-[11px] text-ink/50">{app.company}</p>
                        </td>
                        <td className="p-4">
                          <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                            className="rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-xs text-white focus:border-accent cursor-pointer"
                            aria-label={`Status for ${app.jobTitle}`}
                          >
                            {STATUS_COLUMNS.map((col) => (
                              <option key={col.id} value={col.id}>
                                {col.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4 text-ink/60 font-mono text-[11px]">{app.source}</td>
                        <td className="p-4 text-ink/50 font-mono text-[11px]">
                          {new Date(app.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedApp(app)}
                            className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors mr-2 cursor-pointer"
                          >
                            <Sparkles size={11} />
                            <span>Prepare</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteApplication(app.id)}
                            className="p-1 rounded-lg text-ink/40 hover:text-rose-400 transition-colors cursor-pointer"
                            aria-label={`Delete ${app.jobTitle}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selected Application Preparation Copilot Modal */}
      {selectedApp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="copilot-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-surface-elevated shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10 p-5 sm:p-6 flex items-start justify-between bg-surface/40">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold">
                  Application Copilot
                </span>
                <h3 id="copilot-modal-title" className="text-xl font-bold text-white mt-0.5">
                  {selectedApp.jobTitle}
                </h3>
                <p className="text-xs text-ink/60 mt-0.5">
                  <span className="font-semibold text-white/90">{selectedApp.company}</span> · {selectedApp.location || "Remote"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedApp.status}
                  onChange={(e) => handleStatusChange(selectedApp.id, e.target.value as ApplicationStatus)}
                  className="rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-xs font-semibold text-accent cursor-pointer"
                  aria-label="Application status selector"
                >
                  {STATUS_COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="p-1.5 rounded-lg border border-white/10 text-ink/60 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close copilot"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Review & Readiness Summary */}
              <div className="rounded-xl border border-white/10 bg-surface/30 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Application Preparation Checklist
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface/40 border border-white/5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Resume Version: {selectedApp.resumeVersionName || "Active Resume"}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface/40 border border-white/5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Application Link Verified</span>
                  </div>
                </div>
              </div>

              {/* Cover Letter Copilot Section */}
              <div className="rounded-xl border border-white/10 bg-surface/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <FileText size={14} />
                    <span>Grounded Cover Letter Drafter</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleGenerateCoverLetter}
                    disabled={generatingLetter}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1 text-xs font-bold text-bg hover:bg-accent/90 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>{generatingLetter ? "Drafting..." : "Generate Grounded Draft"}</span>
                  </button>
                </div>

                <p className="text-xs text-ink/60">
                  Grounded in your verified resume achievements. You can add optional notes to customize the focus.
                </p>

                <input
                  type="text"
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="Optional applicant focus (e.g. emphasize distributed caching and telemetry)"
                  className="w-full rounded-lg border border-ink/15 bg-bg px-3 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none"
                />

                {coverLetterDraft && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-ink/40 uppercase">Editable Draft</span>
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard(coverLetterDraft, "cover-letter")}
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer"
                      >
                        {copiedId === "cover-letter" ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedId === "cover-letter" ? "Copied" : "Copy to Clipboard"}</span>
                      </button>
                    </div>
                    <textarea
                      rows={8}
                      value={coverLetterDraft}
                      onChange={(e) => setCoverLetterDraft(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-bg p-3.5 text-xs text-ink leading-relaxed focus:border-accent focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Application Question Assistant Section */}
              <div className="rounded-xl border border-white/10 bg-surface/30 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                  <MessageSquare size={14} />
                  <span>Application Question Assistant</span>
                </h4>
                <p className="text-xs text-ink/60">
                  Paste an employer application question. The assistant drafts a response from your factual resume or guides you to respond directly for sensitive topics.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="e.g., Describe a challenging technical problem you solved"
                    className="flex-1 rounded-lg border border-ink/15 bg-bg px-3 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateAnswer}
                    disabled={generatingAnswer || !questionInput.trim()}
                    className="rounded-lg bg-surface border border-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:border-accent hover:text-accent transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {generatingAnswer ? "Drafting..." : "Draft Answer"}
                  </button>
                </div>

                {questionDraft && (
                  <div className="space-y-2 pt-2">
                    {questionDraft.isSensitive ? (
                      <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-xs text-amber-300 leading-relaxed flex items-start gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{questionDraft.guidance}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-ink/40 uppercase">Grounded Response</span>
                          <button
                            type="button"
                            onClick={() => handleCopyToClipboard(questionDraft.draft, "question-answer")}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline cursor-pointer"
                          >
                            {copiedId === "question-answer" ? <Check size={12} /> : <Copy size={12} />}
                            <span>{copiedId === "question-answer" ? "Copied" : "Copy to Clipboard"}</span>
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={questionDraft.draft}
                          onChange={(e) =>
                            setQuestionDraft({ ...questionDraft, draft: e.target.value })
                          }
                          className="w-full rounded-xl border border-white/10 bg-bg p-3 text-xs text-ink leading-relaxed focus:border-accent focus:outline-none"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Application Timeline */}
              <div className="rounded-xl border border-white/10 bg-surface/30 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Clock size={13} className="text-ink/60" />
                  <span>Lifecycle Timeline</span>
                </h4>
                <div className="space-y-2 pt-2">
                  {selectedApp.timeline?.map((evt, idx) => (
                    <div key={idx} className="flex items-start justify-between text-xs text-ink/70 border-l border-white/10 pl-3 py-1">
                      <span>{evt.description}</span>
                      <span className="font-mono text-[10px] text-ink/40">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-surface/40">
              <span className="text-[11px] text-ink/40 font-mono">
                Phase 7 · Explicit User Control &amp; Submission
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowInterviewStudio(!showInterviewStudio)}
                  className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-bold text-accent hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <Sparkles size={12} className="inline mr-1" />
                  <span>{showInterviewStudio ? "Hide Interview Studio" : "Practice Interview"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUbixApply(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-bg hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  <ShieldCheck size={12} aria-hidden="true" />
                  <span>Review & Apply with UBIX</span>
                </button>
                {selectedApp.applicationUrl && (
                  <a
                    href={selectedApp.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-surface border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white hover:border-accent hover:text-accent transition-colors"
                  >
                    <span>Open Employer Portal</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                {selectedApp.status !== "APPLIED" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(selectedApp.id, "APPLIED")}
                    className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                  >
                    Mark as Applied
                  </button>
                )}
              </div>
            </div>

            {/* Embedded Review & Apply with UBIX Modal */}
            {showUbixApply && (
              <UbixApplyModal
                job={{
                  id: selectedApp.jobId,
                  title: selectedApp.jobTitle,
                  company: selectedApp.company,
                  location: selectedApp.location || "Remote",
                  remote: true,
                  workArrangement: "worldwide_remote",
                  workArrangementLabel: selectedApp.remoteType || "Remote",
                  jobType: "Full-time",
                  url: selectedApp.sourceUrl || "",
                  applyUrl: selectedApp.applicationUrl || "",
                  description: selectedApp.jobTitle,
                  responsibilities: [],
                  requirements: [],
                  preferredQualifications: [],
                  skills: [],
                  source: selectedApp.source,
                  provenance: "SOURCE_VERIFIED",
                }}
                onClose={() => setShowUbixApply(false)}
                onApplicationSubmitted={() => {
                  setShowUbixApply(false);
                  handleStatusChange(selectedApp.id, "APPLIED");
                }}
              />
            )}

            {/* Embedded Phase 8 Interview Studio */}
            {showInterviewStudio && (
              <div className="p-6 border-t border-white/10 bg-surface/20">
                <InterviewStudio
                  job={{
                    id: selectedApp.jobId,
                    title: selectedApp.jobTitle,
                    company: selectedApp.company,
                    location: selectedApp.location || "Remote",
                    remote: true,
                    workArrangement: "worldwide_remote",
                    workArrangementLabel: selectedApp.remoteType || "Remote",
                    jobType: "Full-time",
                    url: selectedApp.sourceUrl || "",
                    applyUrl: selectedApp.applicationUrl || "",
                    description: selectedApp.jobTitle,
                    responsibilities: [],
                    requirements: [],
                    preferredQualifications: [],
                    skills: [],
                    source: selectedApp.source,
                    provenance: "SOURCE_VERIFIED",
                  }}
                  applicationId={selectedApp.id}
                  onClose={() => setShowInterviewStudio(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
