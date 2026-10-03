/**
 * lib/apply/schemas.ts
 *
 * UBIX Apply Canonical Schemas
 *
 * Core data contracts governing structured job application preparation,
 * privacy-preserving field minimization, and explicit review checkpoints.
 *
 * Schemas:
 * - CANDIDATE_PROFILE
 * - APPLICATION_DRAFT
 * - FIELD_MAPPING
 * - APPLICATION_VALIDATION
 * - APPLICATION_STATUS
 */

export interface CandidateApplyProfile {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  locationCity: string;
  locationCountry: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  resumeBulletPoints: string[];
  confirmedSkills: string[];
  workAuthorizationStatus: "CITIZEN" | "PERMANENT_RESIDENT" | "REQUIRES_SPONSORSHIP" | "UNKNOWN";
  disabilityAccommodationNotes?: string;
  eeoDisclosures?: {
    gender?: string;
    raceEthnicity?: string;
    veteranStatus?: string;
    disabilityStatus?: string;
  };
}

export type FieldNecessity = "REQUIRED" | "OPTIONAL" | "UNNECESSARY" | "UNKNOWN";

export interface MappedApplicationField {
  externalFieldKey: string;
  externalFieldLabel: string;
  mappedValue: string | boolean | string[] | undefined;
  necessity: FieldNecessity;
  isSensitive: boolean;
  purposeRationale: string;
  userApproved: boolean;
}

export interface ApplicationValidationResult {
  isValid: boolean;
  missingRequiredFields: string[];
  unnecessaryFieldsPruned: string[];
  warnings: string[];
}

export type ApplicationWorkflowStatus =
  | "DRAFTED"
  | "READY_FOR_REVIEW"
  | "WAITING_FOR_CONFIRMATION"
  | "USER_APPROVED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "FAILED"
  | "REJECTED_BY_USER";

export interface ApplicationDraft {
  applicationId: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  sourceProvider: "greenhouse" | "lever" | "workday" | "generic_direct";
  mappedFields: MappedApplicationField[];
  validation: ApplicationValidationResult;
  status: ApplicationWorkflowStatus;
  userConfirmationToken?: string;
  confirmedAt?: string;
  submittedAt?: string;
  providerSubmissionConfirmationId?: string;
  createdAt: string;
  updatedAt: string;
}
