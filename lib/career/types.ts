/**
 * lib/career/types.ts
 *
 * Authoritative Canonical Data Models for Career Intelligence:
 * Phase 6 Architecture:
 * - CandidateProfile (synthesized from CanonicalResume + AppState)
 * - NormalizedJob (structured job posting with strict provenance)
 * - NormalizedRequirement (classified: REQUIRED | PREFERRED | OPTIONAL | UNKNOWN)
 * - MatchDimension (explainable matching status: MATCHED | PARTIAL | MISSING | EVIDENCE_GAP | UNKNOWN)
 * - ExplainableMatchResult (evidence-backed decision support, no opaque scores)
 * - ApplicationReadiness (actionable preparation checklist, user-controlled)
 * - UserSavedJob (user-scoped saved opportunity)
 *
 * Invariant: Never fabricates metrics, hiring predictions, or candidate information.
 * Invariant: Accessibility preferences remain user preferences, never employment disqualifiers.
 */

import type { CanonicalResume } from "@/lib/resume/structuredParser";
import type { LiveJob, SalaryRange, AccessibilityProfile } from "@/app/api/jobs/route";

export type RequirementType = "REQUIRED" | "PREFERRED" | "OPTIONAL" | "UNKNOWN";

export type RequirementCategory =
  | "skill"
  | "experience"
  | "education"
  | "certification"
  | "responsibility"
  | "location"
  | "general";

export interface NormalizedRequirement {
  id: string;
  text: string;
  normalizedSkill?: string;
  type: RequirementType;
  category: RequirementCategory;
  yearsRequired?: number;
}

export type MatchStatus = "MATCHED" | "PARTIAL" | "MISSING" | "EVIDENCE_GAP" | "UNKNOWN";

export interface MatchDimension {
  requirement: NormalizedRequirement;
  status: MatchStatus;
  evidence?: string;
  reason?: string;
  confidence: number; // 0.0 to 1.0 based on deterministic heuristics
}

export interface SkillGapItem {
  skill: string;
  importance: RequirementType;
  status: MatchStatus;
  actionRecommendation: string;
}

export interface ApplicationReadinessCheck {
  id: string;
  label: string;
  status: "ready" | "needs_attention" | "optional";
  details: string;
}

export interface ApplicationReadiness {
  isReady: boolean;
  scoreExplanation: string;
  checks: ApplicationReadinessCheck[];
  preparationSteps: string[];
}

export interface ExplainableMatchResult {
  jobId: string;
  jobTitle: string;
  company: string;
  resumeVersionUsed?: string;
  analyzedAt: string;
  dimensions: MatchDimension[];
  summary: {
    stronglySupported: string[];
    partiallySupported: string[];
    evidenceGaps: string[];
    missing: string[];
    unknown: string[];
  };
  skillGaps: SkillGapItem[];
  applicationReadiness: ApplicationReadiness;
  whyExplanation: string;
  provenanceNotice: string;
}

export interface CandidateProfile {
  id?: string;
  name: string;
  headline?: string;
  summary: string;
  skills: {
    explicit: string[];
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloud: string[];
    tools: string[];
    other: string[];
  };
  experience: {
    id: string;
    company: string;
    role: string;
    duration: string;
    bullets: string;
  }[];
  education: {
    institution: string;
    degree: string;
    graduationYear: string;
  }[];
  projects: {
    title: string;
    techStack: string;
    description: string;
  }[];
  certifications: string[];
  targetRole?: string;
  preferredLocations?: string[];
  workArrangementPreference?: "remote" | "hybrid" | "onsite" | "any";
}

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  country?: string;
  remote: boolean;
  workArrangement: "worldwide_remote" | "country_remote" | "hybrid" | "onsite";
  workArrangementLabel: string;
  jobType: string;
  url: string;
  applyUrl: string;
  description: string;
  responsibilities: string[];
  requirements: NormalizedRequirement[];
  preferredQualifications: NormalizedRequirement[];
  skills: string[];
  salary?: SalaryRange;
  accessibility?: AccessibilityProfile;
  postedAt?: string;
  deadline?: string;
  source: string;
  provenance: "SOURCE_VERIFIED" | "USER_INPUT" | "ESTIMATED" | "INFERRED" | "UNKNOWN";
  rawDescription?: string;
}

export interface UserSavedJob {
  id: string;
  userId: string;
  job: NormalizedJob;
  savedAt: string;
  lastAnalysis?: ExplainableMatchResult;
  notes?: string;
}

// ─── Phase 7: Application Lifecycle & Copilot Types ─────────────────────────

export type ApplicationStatus =
  | "SAVED"
  | "PREPARING"
  | "READY"
  | "APPLIED"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN"
  | "ARCHIVED";

export type ApplicationMaterialType =
  | "RESUME_REFERENCE"
  | "COVER_LETTER"
  | "QUESTION_ANSWER"
  | "NOTE";

export interface ApplicationMaterial {
  id: string;
  applicationId: string;
  type: ApplicationMaterialType;
  title: string;
  content: string;
  questionPrompt?: string;
  questionCategory?:
    | "experience"
    | "motivation"
    | "behavioral"
    | "technical"
    | "sensitive"
    | "general";
  isDraft: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationTimelineEvent {
  id: string;
  applicationId: string;
  eventType:
    | "JOB_SAVED"
    | "PREPARATION_STARTED"
    | "RESUME_SELECTED"
    | "COVER_LETTER_DRAFTED"
    | "MARKED_READY"
    | "MARKED_APPLIED"
    | "INTERVIEW_SCHEDULED"
    | "OFFER_RECEIVED"
    | "STATUS_CHANGED"
    | "NOTE_ADDED";
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ApplicationRecord {
  id: string;
  userId: string;
  jobId: string;
  savedJobId?: string;
  company: string;
  jobTitle: string;
  location?: string;
  remoteType?: string;
  source: string;
  sourceUrl?: string;
  applicationUrl?: string;
  status: ApplicationStatus;
  resumeVersionId?: string;
  resumeVersionName?: string;
  appliedAt?: string;
  deadline?: string;
  nextAction?: string;
  nextActionAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  materials: ApplicationMaterial[];
  timeline: ApplicationTimelineEvent[];
  lastMatchResult?: ExplainableMatchResult;
  interviews?: InterviewRecord[];
  offers?: OfferRecord[];
}

// ─── Phase 8: Interview Studio & Offer Workspace Types ──────────────────────

export type InterviewRoundType =
  | "PHONE_SCREEN"
  | "RECRUITER"
  | "TECHNICAL"
  | "BEHAVIORAL"
  | "SYSTEM_DESIGN"
  | "MANAGER"
  | "PANEL"
  | "FINAL"
  | "OTHER";

export type QuestionCategory =
  | "TECHNICAL"
  | "BEHAVIORAL"
  | "ROLE_SPECIFIC"
  | "PROJECT"
  | "SYSTEM_DESIGN"
  | "MOTIVATION"
  | "RESUME"
  | "GENERAL";

export type QuestionDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface InterviewQuestion {
  id: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  question: string;
  prompt?: string;
  contextOrRationale?: string;
  suggestedEvidenceSnippets?: string[];
  starCoachingTips?: {
    situationHint?: string;
    taskHint?: string;
    actionHint?: string;
    resultHint?: string;
  };
}

export interface PracticeFeedback {
  strengths: string[];
  improvements: string[];
  evidenceCited: string[];
  suggestions?: string[];
  relevanceScore?: number;
  conceptsMentioned?: string[];
  overallScore?: number;
  feedbackSummary?: string;
  starBreakdown?: {
    situationPresent: boolean;
    taskPresent: boolean;
    actionPresent: boolean;
    resultPresent: boolean;
    guidance?: string;
  };
  overallGuidance: string;
}

export interface PracticeSessionItem {
  id: string;
  question: InterviewQuestion;
  userAnswer: string;
  mode: "TEXT" | "VOICE";
  audioDurationSeconds?: number;
  feedback?: PracticeFeedback;
  completedAt: string;
}

export interface PracticeSession {
  id: string;
  userId: string;
  applicationId?: string;
  jobTitle: string;
  company: string;
  mode: "TEXT" | "VOICE";
  startedAt: string;
  completedAt?: string;
  items: PracticeSessionItem[];
}

export interface InterviewRecord {
  id: string;
  applicationId: string;
  userId: string;
  roundNumber: number;
  roundType: InterviewRoundType;
  scheduledAt: string;
  durationMinutes?: number;
  format: "VIDEO" | "PHONE" | "ON_SITE" | "OTHER";
  interviewerNames?: string;
  notes?: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}

export interface OfferRecord {
  id: string;
  applicationId?: string;
  userId: string;
  company: string;
  role: string;
  baseCompensation?: string;
  bonus?: string;
  equity?: string;
  benefits?: string;
  location?: string;
  remoteType?: string;
  startDate?: string;
  deadline?: string;
  notes?: string;
  userCriteria?: Record<string, string>; // e.g. { "Flexibility": "High", "Commute": "None" }
  customCriteria?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}


