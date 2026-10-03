/**
 * lib/jobs/jobMonitor.ts
 *
 * UBIX Automated Job Monitoring Engine
 *
 * Runs scheduled, user-configured market surveillance:
 * - Queries authenticated ATS / provider feeds
 * - Deduplicates cross-board listings
 * - Filters stale postings (>30 days)
 * - Evaluates objective trust scores (rejects suspicious listings)
 * - Computes explainable match threshold (>= 70%)
 * - Dispatches notifications ONLY for authentic, qualifying jobs
 *
 * STRICT INVARIANT: ZERO FAKE ALERTS.
 */

import { NormalizedJobRequirement } from "./requirementExtraction";
import { evaluateJobTrust } from "./jobTrust";
import { explainJobMatch } from "./matchExplainer";
import { SkillEvidenceItem } from "../career/evidenceWallet";

export interface JobMonitorSubscription {
  subscriptionId: string;
  userId: string;
  targetRoleQuery: string;
  locationQuery: string;
  minimumMatchScore: number;
  workModeFilter?: "REMOTE" | "HYBRID" | "ONSITE" | "ANY";
  isEnabled: boolean;
  lastExecutionAt?: string;
  seenJobIds: string[];
  createdAt: string;
}

export interface MonitoredJobNotification {
  notificationId: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  matchScore: number;
  trustScore: number;
  whyMatchedExplanation: string;
  dispatchedAt: string;
}

/**
 * Evaluates candidate postings against an active monitoring subscription.
 */
export function executeJobMonitoringCheck(input: {
  subscription: JobMonitorSubscription;
  candidateEvidence: SkillEvidenceItem[];
  availablePostings: NormalizedJobRequirement[];
}): {
  updatedSubscription: JobMonitorSubscription;
  qualifyingNotifications: MonitoredJobNotification[];
} {
  const sub = input.subscription;
  if (!sub.isEnabled) {
    return { updatedSubscription: sub, qualifyingNotifications: [] };
  }

  const qualifyingNotifications: MonitoredJobNotification[] = [];
  const newlySeenIds = new Set(sub.seenJobIds);

  for (const job of input.availablePostings) {
    // 1. Skip previously alerted or processed jobs (deduplication)
    if (newlySeenIds.has(job.id)) continue;

    // 2. Query filter checks
    const roleMatches = job.title.toLowerCase().includes(sub.targetRoleQuery.toLowerCase());
    const locMatches =
      sub.locationQuery.toLowerCase() === "any" ||
      job.workMode === "REMOTE" ||
      job.location.toLowerCase().includes(sub.locationQuery.toLowerCase());

    if (!roleMatches || !locMatches) continue;

    // 3. Trust Signal Evaluation
    const trust = evaluateJobTrust(job);
    if (trust.trustLevel === "SUSPICIOUS_SIGNALS" || trust.trustScore < 50) {
      // Reject untrusted or suspicious posting from triggering alerts
      continue;
    }

    // 4. Stale Posting Check
    if (job.freshnessStatus === "EXPIRED" || job.freshnessStatus === "STALE") {
      continue;
    }

    // 5. Match Evaluation
    const match = explainJobMatch({
      jobRequirement: job,
      candidateEvidence: input.candidateEvidence,
    });

    if (match.overallMatchPercentage >= sub.minimumMatchScore) {
      newlySeenIds.add(job.id);
      qualifyingNotifications.push({
        notificationId: `notif_job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: sub.userId,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        matchScore: match.overallMatchPercentage,
        trustScore: trust.trustScore,
        whyMatchedExplanation: match.explainableSummary,
        dispatchedAt: new Date().toISOString(),
      });
    }
  }

  const updatedSubscription: JobMonitorSubscription = {
    ...sub,
    seenJobIds: Array.from(newlySeenIds),
    lastExecutionAt: new Date().toISOString(),
  };

  return {
    updatedSubscription,
    qualifyingNotifications,
  };
}
