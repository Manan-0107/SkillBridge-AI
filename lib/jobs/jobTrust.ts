/**
 * lib/jobs/jobTrust.ts
 *
 * UBIX Job Trust & Scam Detection System
 *
 * Analyzes employer transparency, contact channels, posting freshness, and compensation
 * realism to compute objective trust classifications.
 *
 * Invariant: Never definitively labels a job as fraudulent without hard evidence.
 * Classifications: VERIFIED_SOURCE | INSUFFICIENT_EVIDENCE | LOWER_TRUST | SUSPICIOUS_SIGNALS
 */

import { NormalizedJobRequirement } from "./requirementExtraction";

export type TrustLevel =
  | "VERIFIED_SOURCE"
  | "INSUFFICIENT_EVIDENCE"
  | "LOWER_TRUST"
  | "SUSPICIOUS_SIGNALS";

export interface TrustSignalEvaluation {
  jobId: string;
  trustLevel: TrustLevel;
  trustScore: number; // 0 to 100
  positiveSignals: string[];
  riskSignals: string[];
  isDuplicate: boolean;
  duplicateOfJobId?: string;
  isStale: boolean;
  actionGuidance: string;
}

/**
 * Known trusted ATS / verified job boards
 */
const KNOWN_TRUSTED_SOURCES = new Set([
  "greenhouse",
  "lever",
  "workday",
  "ashby",
  "smartrecruiters",
  "linkedin_direct",
  "indeed_verified",
  "github_jobs",
]);

/**
 * Suspicious keyword / phrase detection
 */
const SUSPICIOUS_PATTERNS = [
  /wire\s*transfer/i,
  /western\s*union/i,
  /crypto\s*payment/i,
  /pay\s*for\s*equipment/i,
  /check\s*deposit/i,
  /telegram\s*(?:interview|chat|handle)/i,
  /whatsapp\s*(?:interview|chat)/i,
  /no\s*experience\s*needed.*\$[5-9]\d{2,}\/day/i,
  /bank\s*account\s*details/i,
  /pay\s*application\s*fee/i,
];

/**
 * Evaluates the factual trust indicators for a given job posting.
 */
export function evaluateJobTrust(
  job: NormalizedJobRequirement,
  existingJobIndex?: NormalizedJobRequirement[]
): TrustSignalEvaluation {
  const positiveSignals: string[] = [];
  const riskSignals: string[] = [];
  let score = 70; // baseline

  // 1. Source verification
  const sourceLower = job.sourceProvider.toLowerCase();
  if (KNOWN_TRUSTED_SOURCES.has(sourceLower)) {
    positiveSignals.push(`Posting sourced from verified employer ATS (${job.sourceProvider}).`);
    score += 15;
  } else {
    positiveSignals.push(`Sourced from general provider (${job.sourceProvider}).`);
  }

  // 2. Employer Identity check
  if (!job.company || job.company.toLowerCase() === "confidential" || job.company.toLowerCase() === "unknown") {
    riskSignals.push("Employer company identity is undisclosed or generic.");
    score -= 20;
  } else {
    positiveSignals.push(`Explicit employer identified: ${job.company}.`);
  }

  // 3. Text Scam Pattern Analysis
  const fullText = (job.rawTextExcerpt + " " + job.responsibilities.join(" ")).toLowerCase();
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(fullText)) {
      riskSignals.push(`Posting contains high-risk financial or off-platform communication terms: ${pattern.source}`);
      score -= 35;
    }
  }

  // 4. Contact method safety
  if (fullText.includes("@gmail.com") || fullText.includes("@yahoo.com") || fullText.includes("@hotmail.com")) {
    riskSignals.push("Contact email uses free public domain rather than verified corporate domain.");
    score -= 15;
  }

  // 5. Freshness / Staleness
  const isStale = job.freshnessStatus === "STALE" || job.freshnessStatus === "EXPIRED";
  if (isStale) {
    riskSignals.push(`Posting is older than 30 days (${job.freshnessStatus.toLowerCase()}).`);
    score -= 10;
  } else {
    positiveSignals.push("Posting is active and fresh.");
  }

  // 6. Duplicate Detection
  let isDuplicate = false;
  let duplicateOfJobId: string | undefined;

  if (existingJobIndex && existingJobIndex.length > 0) {
    const existing = existingJobIndex.find(
      (other) =>
        other.id !== job.id &&
        other.company.toLowerCase() === job.company.toLowerCase() &&
        other.title.toLowerCase() === job.title.toLowerCase() &&
        other.location.toLowerCase() === job.location.toLowerCase()
    );

    if (existing) {
      isDuplicate = true;
      duplicateOfJobId = existing.id;
      riskSignals.push(`Identical posting detected (duplicate of ${existing.id}).`);
      score -= 10;
    }
  }

  // Determine categorical classification
  score = Math.max(0, Math.min(100, score));

  let trustLevel: TrustLevel;
  let actionGuidance: string;

  if (riskSignals.some((r) => r.includes("high-risk financial") || r.includes("off-platform"))) {
    trustLevel = "SUSPICIOUS_SIGNALS";
    actionGuidance = "Caution: Posting exhibits suspicious signals. Do not provide personal identification, banking details, or off-platform chats.";
  } else if (score < 50) {
    trustLevel = "LOWER_TRUST";
    actionGuidance = "Exercise discretion: Key employer data is missing or posting is stale.";
  } else if (positiveSignals.length > 0 && KNOWN_TRUSTED_SOURCES.has(sourceLower)) {
    trustLevel = "VERIFIED_SOURCE";
    actionGuidance = "Verified: Sourced directly from authentic employer ATS portal.";
  } else {
    trustLevel = "INSUFFICIENT_EVIDENCE";
    actionGuidance = "Standard listing with insufficient independent verification data.";
  }

  return {
    jobId: job.id,
    trustLevel,
    trustScore: score,
    positiveSignals,
    riskSignals,
    isDuplicate,
    duplicateOfJobId,
    isStale,
    actionGuidance,
  };
}
