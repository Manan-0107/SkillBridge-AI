/**
 * lib/jobs/accessibilityProfiles.ts
 *
 * UBIX Accessibility-Aware Job Matching & Employer Accessibility Profiles
 *
 * Evaluates employer accessibility practices strictly from factual, verifiable
 * documentation and confirmed public commitments.
 *
 * Invariant: Never guesses or infers disability accommodations, cultural
 * suitability, or compliance from employer prestige or assumptions.
 */

export interface EmployerAccessibilityProfile {
  company: string;
  hasDocumentedAccommodationProcess: boolean;
  accommodationContactEmail?: string;
  publicAccessibilityStatementUrl?: string;
  screenReaderCompatibleApplicationPortal: boolean | "UNKNOWN";
  remoteFlexibilityVerified: boolean;
  sourceEvidence: Array<{
    type: "POLICY_DOCUMENT" | "JOB_DESCRIPTION_DISCLOSURE" | "USER_CONFIRMED_AUDIT";
    detail: string;
    verifiedAt: string;
  }>;
}

export interface PostingAccessibilityReport {
  jobId: string;
  isPlainLanguageClear: boolean;
  hasClearAccommodationStatement: boolean;
  hasExplicitWorkHoursFlexibility: boolean;
  declaredAssistiveTechSupport: string[];
  unverifiedClaims: string[];
  summary: string;
}

/**
 * Checks an individual job posting for factual, explicit accessibility provisions.
 */
export function checkPostingAccessibility(
  jobId: string,
  rawText: string
): PostingAccessibilityReport {
  const text = rawText.toLowerCase();

  const hasClearAccommodationStatement =
    text.includes("reasonable accommodation") ||
    text.includes("accommodations available") ||
    text.includes("disability accommodation");

  const hasExplicitWorkHoursFlexibility =
    text.includes("flexible hours") ||
    text.includes("core hours") ||
    text.includes("flexible schedule");

  const declaredAssistiveTechSupport: string[] = [];
  if (text.includes("screen reader") || text.includes("accessible portal")) {
    declaredAssistiveTechSupport.push("Screen Reader portal compatibility claimed");
  }
  if (text.includes("captions provided") || text.includes("asl interpretation")) {
    declaredAssistiveTechSupport.push("Interview captions/ASL support claimed");
  }

  // Detect vague buzzwords that lack factual guarantees
  const unverifiedClaims: string[] = [];
  if (text.includes("inclusive culture") && !hasClearAccommodationStatement) {
    unverifiedClaims.push("Contains broad 'inclusive culture' statement without specific accommodation procedures.");
  }

  const isPlainLanguageClear = rawText.length < 8000 && !text.includes("ninja") && !text.includes("rockstar");

  let summary = "No explicit accessibility provisions disclosed in job text.";
  if (hasClearAccommodationStatement && declaredAssistiveTechSupport.length > 0) {
    summary = "High accessibility disclosure: Explicit accommodation process and assistive technology provisions documented.";
  } else if (hasClearAccommodationStatement) {
    summary = "Documented accommodation process present. Specific interview tech accessibility unstated (UNKNOWN).";
  }

  return {
    jobId,
    isPlainLanguageClear,
    hasClearAccommodationStatement,
    hasExplicitWorkHoursFlexibility,
    declaredAssistiveTechSupport,
    unverifiedClaims,
    summary,
  };
}

/**
 * Creates or retrieves a factual employer accessibility profile.
 */
export function createFactualEmployerProfile(input: {
  company: string;
  accommodationStatement?: string;
  portalTestedScreenReader?: boolean;
  flexibleHours?: boolean;
}): EmployerAccessibilityProfile {
  const sourceEvidence: EmployerAccessibilityProfile["sourceEvidence"] = [];

  if (input.accommodationStatement) {
    sourceEvidence.push({
      type: "JOB_DESCRIPTION_DISCLOSURE",
      detail: input.accommodationStatement,
      verifiedAt: new Date().toISOString(),
    });
  }

  return {
    company: input.company,
    hasDocumentedAccommodationProcess: !!input.accommodationStatement,
    screenReaderCompatibleApplicationPortal:
      typeof input.portalTestedScreenReader === "boolean"
        ? input.portalTestedScreenReader
        : "UNKNOWN",
    remoteFlexibilityVerified: !!input.flexibleHours,
    sourceEvidence,
  };
}
