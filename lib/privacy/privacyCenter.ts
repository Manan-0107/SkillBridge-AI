/**
 * lib/privacy/privacyCenter.ts
 *
 * UBIX Privacy Center & Data Minimization Architecture
 *
 * Provides:
 * 1. Data Minimization Classification (REQUIRED, OPTIONAL, UNNECESSARY, UNKNOWN).
 * 2. "Why is UBIX asking this?" transparent explanation engine.
 * 3. User-controlled data export and deletion planning.
 *
 * Invariant:
 * - Never shares user data without explicit user action.
 * - Always explains purpose and data flow before collecting sensitive data.
 */

export type FieldNecessity = "REQUIRED" | "OPTIONAL" | "UNNECESSARY" | "UNKNOWN";

export interface FieldExplanation {
  field: string;
  necessity: FieldNecessity;
  purpose: string;
  whereUsed: string[];
  stored: "SECURE_DATABASE" | "LOCAL_SESSION_ONLY" | "NOT_STORED";
  whoReceives: string;
  canSkip: boolean;
  retentionPolicy: string;
}

const FIELD_EXPLANATIONS: Record<string, FieldExplanation> = {
  target_role: {
    field: "target_role",
    necessity: "REQUIRED",
    purpose: "To construct your personalized career roadmap and match relevant jobs.",
    whereUsed: ["Roadmap Engine", "Job Matching", "Skills Gap Analysis"],
    stored: "SECURE_DATABASE",
    whoReceives: "Platform internal algorithms only.",
    canSkip: false,
    retentionPolicy: "Retained until you change your target career goal.",
  },
  accessibility_profile: {
    field: "accessibility_profile",
    necessity: "OPTIONAL",
    purpose: "To tailor display contrast, speech output, and interaction methods to your exact accessibility needs.",
    whereUsed: ["Adaptive Interface Engine", "Voice Engine", "Screen Reader Live Regions"],
    stored: "SECURE_DATABASE",
    whoReceives: "Never shared externally. Internal presentation layer only.",
    canSkip: true,
    retentionPolicy: "Retained until modified or reset in Accessibility Passport.",
  },
  resume_document: {
    field: "resume_document",
    necessity: "OPTIONAL",
    purpose: "To extract verifiable skills, experience, and achievements into your Evidence Wallet.",
    whereUsed: ["Resume Parser", "Skill Evidence System", "Job Match Explainer"],
    stored: "SECURE_DATABASE",
    whoReceives: "Never sent to third parties without your explicit application submission.",
    canSkip: true,
    retentionPolicy: "Retained until you delete or replace the resume upload.",
  },
  github_username: {
    field: "github_username",
    necessity: "OPTIONAL",
    purpose: "To verify open-source projects, programming languages, and technical contributions for your portfolio.",
    whereUsed: ["GitHub Integration", "Project Builder", "Skill Evidence System"],
    stored: "SECURE_DATABASE",
    whoReceives: "Public GitHub API read-only queries.",
    canSkip: true,
    retentionPolicy: "Retained until integration is disconnected.",
  },
  phone_number: {
    field: "phone_number",
    necessity: "OPTIONAL",
    purpose: "Optional communication for urgent interview alerts or SMS notifications.",
    whereUsed: ["Interview Alerts", "Optional 2FA"],
    stored: "SECURE_DATABASE",
    whoReceives: "Never shared with advertisers or third parties.",
    canSkip: true,
    retentionPolicy: "Retained until deleted from user profile.",
  },
  current_salary: {
    field: "current_salary",
    necessity: "OPTIONAL",
    purpose: "To assist you with financial planning and offer comparison calculations.",
    whereUsed: ["Financial Reality Planner", "Offer Engine"],
    stored: "SECURE_DATABASE",
    whoReceives: "Strictly private. Never shared with prospective employers or job providers.",
    canSkip: true,
    retentionPolicy: "Retained until cleared by the user.",
  },
};

/**
 * Returns a comprehensive, transparent explanation for why UBIX asks for a specific field.
 */
export function explainFieldRequest(field: string): FieldExplanation {
  const normalized = (field || "").toLowerCase().trim();
  if (FIELD_EXPLANATIONS[normalized]) {
    return FIELD_EXPLANATIONS[normalized];
  }

  return {
    field: normalized,
    necessity: "UNKNOWN",
    purpose: "Contextual career planning or preference customization.",
    whereUsed: ["Assistant Context Resolver"],
    stored: "SECURE_DATABASE",
    whoReceives: "Internal platform only.",
    canSkip: true,
    retentionPolicy: "Retained while active.",
  };
}

export interface UserDataExportSummary {
  userId: string;
  generatedAt: string;
  dataCategories: {
    category: string;
    itemCount: number;
    description: string;
  }[];
  exportFormat: "JSON";
}

/**
 * Generates an export summary for the authenticated user.
 */
export function exportUserDataSummary(userId: string): UserDataExportSummary {
  return {
    userId,
    generatedAt: new Date().toISOString(),
    dataCategories: [
      { category: "Profile & Identity", itemCount: 1, description: "Basic profile, target role, contact details." },
      { category: "Accessibility Passport", itemCount: 1, description: "Personalized interaction and presentation settings." },
      { category: "Skill Evidence Wallet", itemCount: 0, description: "Verified and user-confirmed skill artifacts." },
      { category: "Career Memory", itemCount: 0, description: "Factual confirmed and inferred preferences." },
      { category: "Automation Audit Logs", itemCount: 0, description: "Historical execution and confirmation logs." },
    ],
    exportFormat: "JSON",
  };
}

export interface DataDeletionPlan {
  userId: string;
  plannedAt: string;
  requiresExplicitConfirmation: true;
  actions: string[];
  warningMessage: string;
}

/**
 * Generates a safe data deletion plan requiring explicit confirmation.
 */
export function prepareDataDeletionPlan(userId: string): DataDeletionPlan {
  return {
    userId,
    plannedAt: new Date().toISOString(),
    requiresExplicitConfirmation: true,
    actions: [
      "Purge user profile and credentials from public.users and auth.users",
      "Delete all uploaded resumes and extracted text",
      "Purge career roadmap milestones and practice history",
      "Clear Personal Career Memory and Skill Evidence Wallet",
      "Revoke all active sessions and OAuth connection tokens",
    ],
    warningMessage:
      "This action is permanent and irreversible. All verified skills, roadmaps, and evidence will be permanently deleted.",
  };
}
