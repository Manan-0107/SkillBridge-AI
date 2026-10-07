"use client";

import React, { useState, useEffect } from "react";
import type { NormalizedJob } from "@/lib/career/types";
import type { ApplicationDraft } from "@/lib/apply/schemas";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
  Eye,
  Send,
  X,
  FileText,
  UserCheck,
  Check,
} from "lucide-react";

interface UbixApplyModalProps {
  job: NormalizedJob;
  onClose: () => void;
  onApplicationSubmitted?: (result: any) => void;
}

export function UbixApplyModal({ job, onClose, onApplicationSubmitted }: UbixApplyModalProps) {
  const [draft, setDraft] = useState<ApplicationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<any | null>(null);

  useEffect(() => {
    prepareDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  const prepareDraft = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/apply/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          company: job.company,
          sourceProvider: "generic_direct",
        }),
      });

      const data = await res.json();
      if (res.ok && data.draft) {
        setDraft(data.draft);
      } else {
        setError(data.message || "Failed to prepare application review draft.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error while preparing draft.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAndSubmit = async () => {
    if (!draft || !draft.userConfirmationToken || !userConfirmed) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/apply/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          confirmationToken: draft.userConfirmationToken,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmissionSuccess(data);
        if (onApplicationSubmitted) {
          onApplicationSubmitted(data);
        }
      } else {
        setError(data.message || "Submission failed. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error submitting application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ubix-apply-title"
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-surface-elevated p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded-md bg-accent/10 border border-accent/20 text-accent">
                <ShieldCheck size={16} aria-hidden="true" />
              </span>
              <span className="font-mono text-xs uppercase tracking-wider text-accent font-semibold">
                Review-First Application Protocol
              </span>
            </div>
            <h2 id="ubix-apply-title" className="text-xl font-bold text-white">
              Review & Apply with UBIX
            </h2>
            <p className="text-xs text-ink/60 mt-0.5">
              Target: <span className="text-white font-semibold">{job.title}</span> at <span className="text-white font-semibold">{job.company}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close apply dialog"
            className="p-1.5 rounded-lg border border-white/10 bg-surface text-ink/50 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-ink/50">
            Mapping candidate profile against ATS specifications and minimizing data...
          </div>
        ) : error && !draft ? (
          <div role="alert" className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-2 text-center">
            <AlertTriangle size={24} className="mx-auto text-rose-400" aria-hidden="true" />
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={prepareDraft}
              className="px-4 py-1.5 rounded-lg bg-surface border border-white/10 text-xs text-white"
            >
              Retry
            </button>
          </div>
        ) : submissionSuccess ? (
          /* Submission Receipt */
          <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-4 text-center">
            <CheckCircle2 size={36} className="mx-auto text-emerald-400" aria-hidden="true" />
            <h3 className="text-lg font-bold text-white">Application Successfully Submitted</h3>
            <p className="text-xs text-ink/80 max-w-md mx-auto">
              Your application was securely submitted with zero data leak. A cryptographic confirmation receipt has been issued.
            </p>
            <div className="bg-bg/60 p-3 rounded-xl border border-white/10 text-xs font-mono text-left max-w-md mx-auto space-y-1">
              <div>Confirmation ID: <span className="text-accent">{submissionSuccess.result.confirmationId}</span></div>
              <div>Receipt Timestamp: <span className="text-ink/60">{submissionSuccess.result.receiptTimestamp}</span></div>
              <div>Provider Status: <span className="text-emerald-400 font-bold">{submissionSuccess.result.status}</span></div>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-accent text-xs font-bold text-bg hover:bg-accent/90 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : draft && (
          <div className="space-y-6">
            {/* 4A: Field Mapping Review Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink/70 font-semibold">
                  Field Mapping Transparency
                </h3>
                <span className="text-[11px] font-mono text-ink/40">
                  {draft.mappedFields.length} outbound fields
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface/30">
                <table className="w-full text-left text-xs text-ink border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 font-mono text-[11px] text-ink/60 uppercase">
                      <th className="p-3">Field</th>
                      <th className="p-3">Source</th>
                      <th className="p-3">Outbound Value</th>
                      <th className="p-3">Destination</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {draft.mappedFields.map((f, i) => (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="p-3 font-semibold text-white">{f.externalFieldLabel}</td>
                        <td className="p-3 text-[11px] text-ink/60 font-mono">UBIX Profile</td>
                        <td className="p-3 text-ink/90 font-mono text-[11px] max-w-[180px] truncate">
                          {f.mappedValue}
                        </td>
                        <td className="p-3 text-[11px] text-ink/60 font-mono">
                          {draft.sourceProvider} → {f.externalFieldKey}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <Check size={10} aria-hidden="true" />
                            <span>Included</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4B: Minimization Details */}
            {draft.validation.unnecessaryFieldsPruned && draft.validation.unnecessaryFieldsPruned.length > 0 && (
              <div className="p-4 rounded-xl border border-white/10 bg-surface/40 space-y-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-accent font-semibold block">
                  Data Minimization Applied
                </span>
                <p className="text-xs text-ink/70 leading-relaxed">
                  UBIX excluded the following non-mandatory fields because they are not required for this employer&apos;s application:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {draft.validation.unnecessaryFieldsPruned.map((field, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-ink/60 line-through"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Required Warning if invalid */}
            {!draft.validation.isValid && (
              <div role="alert" className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 space-y-1">
                <span className="font-bold">Missing Required ATS Fields:</span>
                <ul className="list-disc list-inside">
                  {draft.validation.missingRequiredFields.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4C: Explicit Human Confirmation */}
            {draft.validation.isValid && (
              <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userConfirmed}
                    onChange={(e) => setUserConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-white/20 bg-surface text-accent focus:ring-accent cursor-pointer"
                  />
                  <span className="text-xs text-ink/90 leading-relaxed font-medium">
                    I have reviewed the exact fields above. I authorize UBIX to generate a single-use confirmation token and submit this minimized application data on my behalf.
                  </span>
                </label>

                {draft.userConfirmationToken && (
                  <div className="text-[10px] font-mono text-ink/40 pl-6">
                    Single-use verification token: <span className="text-ink/60">{draft.userConfirmationToken.slice(0, 24)}...</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div role="alert" className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-ink/60 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSubmit}
                disabled={!draft.validation.isValid || !userConfirmed || submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-xs font-bold text-bg hover:bg-accent/90 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Send size={13} aria-hidden="true" />
                <span>{submitting ? "Submitting Application..." : "Confirm & Apply"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
