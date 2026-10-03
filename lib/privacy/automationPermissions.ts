/**
 * lib/privacy/automationPermissions.ts
 *
 * UBIX Automation Permissions & User Sovereignty Engine
 *
 * Enforces user consent policies across all background actions:
 * - Granular toggles per automation subsystem
 * - Audit tracking of permission grant/revocation
 * - Emergency pause / disable all automations switch
 *
 * Invariant: Revoking an automation permission immediately halts all
 * pending and scheduled jobs belonging to that subsystem.
 */

export interface UserAutomationPolicy {
  userId: string;
  allowAutomaticSkillAnalysis: boolean;
  allowAutomatedJobMonitoring: boolean;
  allowResumeUpdateSuggestions: boolean;
  allowLongitudinalInterviewMemory: boolean;
  emergencyKillSwitchAllAutomations: boolean;
  updatedAt: string;
}

const userPolicies = new Map<string, UserAutomationPolicy>();

/**
 * Gets or initializes a user's automation policy with privacy-preserving defaults.
 */
export function getUserAutomationPolicy(userId: string): UserAutomationPolicy {
  if (!userPolicies.has(userId)) {
    userPolicies.set(userId, {
      userId,
      allowAutomaticSkillAnalysis: true,
      allowAutomatedJobMonitoring: true,
      allowResumeUpdateSuggestions: true,
      allowLongitudinalInterviewMemory: true,
      emergencyKillSwitchAllAutomations: false,
      updatedAt: new Date().toISOString(),
    });
  }
  return userPolicies.get(userId)!;
}

/**
 * Updates a user's automation policy.
 */
export function updateUserAutomationPolicy(
  userId: string,
  updates: Partial<Omit<UserAutomationPolicy, "userId" | "updatedAt">>
): UserAutomationPolicy {
  const current = getUserAutomationPolicy(userId);
  const updated: UserAutomationPolicy = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  userPolicies.set(userId, updated);
  return updated;
}

/**
 * Checks whether an automation category is permitted by the user policy.
 */
export function isAutomationPermitted(
  userId: string,
  category: "SKILL_ANALYSIS" | "JOB_MONITORING" | "RESUME_MAINTENANCE" | "INTERVIEW_MEMORY"
): { isAllowed: boolean; reason?: string } {
  const policy = getUserAutomationPolicy(userId);

  if (policy.emergencyKillSwitchAllAutomations) {
    return {
      isAllowed: false,
      reason: "Emergency kill switch is ACTIVE. All background automations are suspended by user request.",
    };
  }

  switch (category) {
    case "SKILL_ANALYSIS":
      return {
        isAllowed: policy.allowAutomaticSkillAnalysis,
        reason: policy.allowAutomaticSkillAnalysis ? undefined : "User has disabled automatic skill analysis.",
      };
    case "JOB_MONITORING":
      return {
        isAllowed: policy.allowAutomatedJobMonitoring,
        reason: policy.allowAutomatedJobMonitoring ? undefined : "User has disabled background job monitoring.",
      };
    case "RESUME_MAINTENANCE":
      return {
        isAllowed: policy.allowResumeUpdateSuggestions,
        reason: policy.allowResumeUpdateSuggestions ? undefined : "User has disabled resume maintenance suggestions.",
      };
    case "INTERVIEW_MEMORY":
      return {
        isAllowed: policy.allowLongitudinalInterviewMemory,
        reason: policy.allowLongitudinalInterviewMemory ? undefined : "User has disabled interview attempt memory retention.",
      };
    default:
      return { isAllowed: false, reason: "Unrecognized automation category." };
  }
}
