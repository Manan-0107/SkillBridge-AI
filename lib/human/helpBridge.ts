/**
 * lib/human/helpBridge.ts
 *
 * UBIX Human Help Bridge
 *
 * Facilitates context-preserving handoffs from automated AI assistance
 * to verified human support staff or mentors.
 *
 * Invariant: Never transfers sensitive or unapproved context.
 * The handoff payload is explicitly displayed to the user for confirmation
 * prior to dispatch.
 */

import { AccessibilityPassport } from "../accessibility/passport";

export interface HumanHandoffTicket {
  ticketId: string;
  userId: string;
  candidateGoal: string;
  activeWorkflow: "RESUME_BUILDING" | "MOCK_INTERVIEW" | "ROADMAP_PLANNING" | "JOB_APPLICATION" | "GENERAL_SUPPORT";
  problemDescription: string;
  relevantContextSummary: string;
  accessibilityAccommodations: {
    preferredInteraction: string;
    requiresScreenReaderSupport: boolean;
    requiresCaptions: boolean;
    requiresReducedMotion: boolean;
  };
  userApprovedSummary: boolean;
  createdAt: string;
  ticketStatus: "OPEN" | "ASSIGNED" | "RESOLVED";
}

/**
 * Compiles a structured, user-approved human handoff ticket.
 */
export function createHumanHandoffTicket(input: {
  userId: string;
  candidateGoal: string;
  activeWorkflow: HumanHandoffTicket["activeWorkflow"];
  problemDescription: string;
  recentRelevantActions: string[];
  passport: AccessibilityPassport;
  userExplicitlyApproved: boolean;
}): HumanHandoffTicket {
  if (!input.userExplicitlyApproved) {
    throw new Error("REJECTED: Human handoff requires explicit user approval of shared context.");
  }

  const contextSummary = input.recentRelevantActions.length > 0
    ? `Recent workflow steps: ${input.recentRelevantActions.slice(-3).join(" → ")}`
    : "No prior workflow actions shared.";

  return {
    ticketId: `tkt_human_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: input.userId,
    candidateGoal: input.candidateGoal,
    activeWorkflow: input.activeWorkflow,
    problemDescription: input.problemDescription,
    relevantContextSummary: contextSummary,
    accessibilityAccommodations: {
      preferredInteraction: input.passport.preferredInteractionMode,
      requiresScreenReaderSupport: input.passport.screenReaderOptimized,
      requiresCaptions: input.passport.captionsEnabled,
      requiresReducedMotion: input.passport.reducedMotion,
    },
    userApprovedSummary: true,
    createdAt: new Date().toISOString(),
    ticketStatus: "OPEN",
  };
}
