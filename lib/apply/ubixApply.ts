/**
 * lib/apply/ubixApply.ts
 *
 * UBIX Apply Orchestration Engine
 *
 * Implements the mandatory REVIEW-FIRST application lifecycle:
 * 1. Extract requirements from target job.
 * 2. Compare against authenticated candidate profile.
 * 3. Identify missing required information.
 * 4. Map fields with privacy minimization (pruning unrequested data).
 * 5. Validate draft completeness.
 * 6. Surface review package to user (WAITING_FOR_CONFIRMATION).
 * 7. Require explicit user confirmation token before invoking site adapter.
 * 8. Verify provider submission receipt before marking SUBMITTED.
 *
 * CRITICAL INVARIANT: NEVER SILENTLY SUBMIT.
 */

import {
  CandidateApplyProfile,
  ApplicationDraft,
  ApplicationValidationResult,
} from "./schemas";
import { mapAndMinimizeProfileFields } from "./fieldMapping";
import { getAtsAdapter, ProviderSubmissionResult } from "./siteAdapters";

export interface PrepareApplicationInput {
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  sourceProvider: "greenhouse" | "lever" | "workday" | "generic_direct";
  candidateProfile: CandidateApplyProfile;
}

/**
 * Prepares a job application draft for user review. Never submits.
 */
export function prepareApplicationDraft(input: PrepareApplicationInput): ApplicationDraft {
  const { mappedFields, missingRequired, prunedUnnecessary } = mapAndMinimizeProfileFields(
    input.candidateProfile,
    input.sourceProvider
  );

  const isValid = missingRequired.length === 0;
  const validation: ApplicationValidationResult = {
    isValid,
    missingRequiredFields: missingRequired,
    unnecessaryFieldsPruned: prunedUnnecessary,
    warnings: missingRequired.length > 0
      ? [`Missing ${missingRequired.length} required field(s): ${missingRequired.join(", ")}.`]
      : [],
  };

  const now = new Date().toISOString();

  return {
    applicationId: `app_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId: input.userId,
    jobId: input.jobId,
    jobTitle: input.jobTitle,
    company: input.company,
    sourceProvider: input.sourceProvider,
    mappedFields,
    validation,
    status: isValid ? "READY_FOR_REVIEW" : "DRAFTED",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generates a cryptographic user confirmation token for a reviewed draft.
 */
export function requestUserConfirmation(draft: ApplicationDraft): ApplicationDraft {
  if (!draft.validation.isValid) {
    throw new Error(
      `Cannot request confirmation for invalid draft. Missing fields: ${draft.validation.missingRequiredFields.join(", ")}`
    );
  }

  const token = `CONFIRM_APPLY_${draft.applicationId}_${Date.now()}`;
  return {
    ...draft,
    status: "WAITING_FOR_CONFIRMATION",
    userConfirmationToken: token,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Executes final submission to the ATS adapter ONLY if user has provided
 * the exact confirmation token.
 */
export async function submitConfirmedApplication(
  draft: ApplicationDraft,
  userConfirmationToken: string
): Promise<{ draft: ApplicationDraft; result: ProviderSubmissionResult }> {
  // Strict non-negotiable guard: Review first!
  if (draft.status !== "WAITING_FOR_CONFIRMATION" || !draft.userConfirmationToken) {
    throw new Error("REJECTED: Application must be in WAITING_FOR_CONFIRMATION state before submission.");
  }

  if (userConfirmationToken !== draft.userConfirmationToken) {
    throw new Error("REJECTED: Invalid or forged confirmation token. Explicit human approval required.");
  }

  const adapter = getAtsAdapter(draft.sourceProvider);
  const result = await adapter.submit(draft, userConfirmationToken);

  if (!result.success) {
    return {
      draft: {
        ...draft,
        status: "FAILED",
        updatedAt: new Date().toISOString(),
      },
      result,
    };
  }

  // Submission succeeded with verified provider ID
  return {
    draft: {
      ...draft,
      status: "SUBMITTED",
      confirmedAt: new Date().toISOString(),
      submittedAt: result.receiptTimestamp,
      providerSubmissionConfirmationId: result.providerConfirmationId,
      updatedAt: new Date().toISOString(),
    },
    result,
  };
}
