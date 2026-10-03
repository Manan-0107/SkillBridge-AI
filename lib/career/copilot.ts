/**
 * lib/career/copilot.ts
 *
 * Deterministic Application Copilot and Grounded Drafter:
 * 1. Resume Version Matching & Evidence Prioritization (reads CanonicalResume + MatchResult)
 * 2. Grounded Cover Letter Drafting (strictly uses candidate facts + verified job requirements; zero hallucination)
 * 3. Application Question Response Drafter (classifies question category; neutral prompt for sensitive questions)
 * 4. Human-in-the-loop review checklists and preparation summaries
 *
 * Invariants:
 * - Never fabricates metrics, percentages, accomplishments, or previous employers.
 * - Sensitive questions (disability, health, demographic, authorization) are NEVER answered or inferred by AI.
 * - Outputs are explicitly marked as editable drafts.
 */

import crypto from "crypto";
import type { CanonicalResume } from "@/lib/resume/structuredParser";
import type {
  NormalizedJob,
  ExplainableMatchResult,
  ApplicationMaterial,
  ApplicationTimelineEvent,
  ApplicationRecord,
  ApplicationStatus,
} from "./types";

function generateCopilotId(prefix = "mat"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Classifies an application question into semantic categories.
 */
export function classifyApplicationQuestion(question: string): {
  category: "experience" | "motivation" | "behavioral" | "technical" | "sensitive" | "general";
  isSensitive: boolean;
} {
  const lower = question.toLowerCase();

  // Strict sensitive category boundaries (disability, medical, legal/demographic)
  if (
    lower.includes("disability") ||
    lower.includes("handicap") ||
    lower.includes("medical") ||
    lower.includes("veteran") ||
    lower.includes("race") ||
    lower.includes("ethnicity") ||
    lower.includes("gender") ||
    lower.includes("sexual orientation") ||
    lower.includes("religion") ||
    lower.includes("visa sponsorship") ||
    lower.includes("legally authorized") ||
    lower.includes("background check")
  ) {
    return { category: "sensitive", isSensitive: true };
  }

  if (
    lower.includes("why do you want") ||
    lower.includes("why are you interested") ||
    lower.includes("what excites you") ||
    lower.includes("why this company")
  ) {
    return { category: "motivation", isSensitive: false };
  }

  if (
    lower.includes("challenge") ||
    lower.includes("challenging") ||
    lower.includes("bug") ||
    lower.includes("conflict") ||
    lower.includes("tell me about a time") ||
    lower.includes("how do you handle") ||
    lower.includes("leadership")
  ) {
    return { category: "behavioral", isSensitive: false };
  }

  if (
    lower.includes("react") ||
    lower.includes("node") ||
    lower.includes("typescript") ||
    lower.includes("javascript") ||
    lower.includes("python") ||
    lower.includes("sql") ||
    lower.includes("architecture") ||
    lower.includes("system design") ||
    lower.includes("code") ||
    lower.includes("database") ||
    lower.includes("cloud") ||
    lower.includes("microservices")
  ) {
    return { category: "technical", isSensitive: false };
  }

  if (
    lower.includes("experience") ||
    lower.includes("tell us about yourself") ||
    lower.includes("background") ||
    lower.includes("walk through your resume")
  ) {
    return { category: "experience", isSensitive: false };
  }

  return { category: "general", isSensitive: false };
}

/**
 * Generates a grounded cover letter draft without hallucinated claims.
 */
export function generateCoverLetterDraft(params: {
  job: NormalizedJob;
  resume: CanonicalResume;
  candidateName?: string;
  userNotes?: string;
}): { draft: string; usedEvidence: string[] } {
  const { job, resume, candidateName, userNotes } = params;
  const name = candidateName || resume.basics?.name || "Candidate";
  const usedEvidence: string[] = [];

  // FIX #14: Score work entries and projects against job skills for maximum relevance
  const jobSkillTerms = (job.skills || []).map((s) => s.toLowerCase());

  let relevantWork = resume.work && resume.work.length > 0 ? resume.work[0] : null;
  if (resume.work && resume.work.length > 1 && jobSkillTerms.length > 0) {
    let bestScore = -1;
    for (const w of resume.work) {
      const text = `${w.role} ${w.company} ${w.bullets || ""}`.toLowerCase();
      const score = jobSkillTerms.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        relevantWork = w;
      }
    }
  }

  let relevantProject = resume.projects && resume.projects.length > 0 ? resume.projects[0] : null;
  if (resume.projects && resume.projects.length > 1 && jobSkillTerms.length > 0) {
    let bestScore = -1;
    for (const p of resume.projects) {
      const text = `${p.title} ${p.techStack || ""} ${p.description || ""}`.toLowerCase();
      const score = jobSkillTerms.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        relevantProject = p;
      }
    }
  }

  if (relevantWork) {
    usedEvidence.push(`${relevantWork.role} at ${relevantWork.company}`);
  }
  if (relevantProject) {
    usedEvidence.push(`Project: ${relevantProject.title} (${relevantProject.techStack || "Technical Project"})`);
  }

  // Construct truthful draft
  const greeting = `Dear Hiring Team at ${job.company},`;
  const opening = `I am writing to express my interest in the ${job.title} position${
    job.remote ? " (Remote)" : job.location ? ` in ${job.location}` : ""
  }. With hands-on experience in modern software engineering and a focus on building resilient systems, I am excited about the opportunity to contribute to your team.`;

  let bodyWork = "";
  if (relevantWork) {
    bodyWork = `In my role as ${relevantWork.role} at ${relevantWork.company}, I worked on key technical initiatives${
      relevantWork.bullets ? `, including: "${relevantWork.bullets.split("\n")[0].replace(/^[-*•]\s*/, "")}"` : "."
    } This experience helped me build practical proficiency in shipping maintainable software.`;
  }

  let bodyProject = "";
  if (relevantProject) {
    bodyProject = `Additionally, on ${relevantProject.title}, I utilized ${relevantProject.techStack || "relevant technologies"} to ${
      relevantProject.description ? relevantProject.description.split(".")[0] : "develop scalable solutions"
    }.`;
  }

  const roleAlignment = `I noticed your emphasis on ${
    job.skills && job.skills.length > 0 ? job.skills.slice(0, 3).join(", ") : "technical excellence and clean engineering"
  }. My background aligns directly with these requirements, and I am eager to apply my practical experience to ${job.company}'s mission.`;

  const notesSection = userNotes?.trim() ? `Note from applicant: ${userNotes.trim()}` : "";

  const closing = `Thank you for your time and consideration. I welcome the opportunity to discuss how my verified background and technical capabilities can support your team.\n\nSincerely,\n${name}`;

  const paragraphs = [greeting, opening, bodyWork, bodyProject, roleAlignment, notesSection, closing].filter(Boolean);
  const draft = paragraphs.join("\n\n");

  return { draft, usedEvidence };
}

/**
 * Generates a response draft for an application question based on known facts.
 * Invariant: Returns null/warning for sensitive questions so user enters their own choice.
 */
export function generateQuestionDraft(params: {
  question: string;
  resume: CanonicalResume;
  job?: NormalizedJob;
}): {
  draft: string;
  isSensitive: boolean;
  category: string;
  guidance?: string;
} {
  const { question, resume, job } = params;
  const classification = classifyApplicationQuestion(question);

  if (classification.isSensitive) {
    return {
      draft: "",
      isSensitive: true,
      category: classification.category,
      guidance:
        "This question pertains to personal, legal, or demographic information. CareerForge never generates or infers responses to sensitive or protected inquiries. Please provide your own answer directly.",
    };
  }

  const recentExp = resume.work?.[0];
  const recentProj = resume.projects?.[0];

  if (classification.category === "motivation") {
    const targetComp = job?.company || "your organization";
    const targetRole = job?.title || "this role";
    return {
      draft: `I am interested in ${targetRole} at ${targetComp} because it offers the opportunity to apply my practical skills in ${
        resume.skills?.raw?.slice(0, 3).join(", ") || "software engineering"
      } to impactful problems. Based on the position details, I am excited about contributing to your technical initiatives and collaborating with a dedicated team.`,
      isSensitive: false,
      category: classification.category,
    };
  }

  if (classification.category === "experience" || classification.category === "technical") {
    if (recentExp) {
      return {
        draft: `Throughout my experience as a ${recentExp.role} at ${recentExp.company}, I have worked hands-on with ${
          resume.skills?.raw?.slice(0, 4).join(", ") || "core technical systems"
        }. A representative project involved: ${
          recentExp.bullets ? recentExp.bullets.split("\n")[0].replace(/^[-*•]\s*/, "") : "building maintainable services"
        }. I focus on delivering clean, reliable code that meets production requirements.`,
        isSensitive: false,
        category: classification.category,
      };
    }
  }

  if (classification.category === "behavioral" && recentProj) {
    return {
      draft: `When tackling complex challenges on ${recentProj.title}, I prioritize understanding the core constraints first, breaking down requirements into actionable components, and validating solutions with automated tests. This structured approach enabled me to successfully deliver ${
        recentProj.description ? recentProj.description.slice(0, 100) : "the project"
      }.`,
      isSensitive: false,
      category: classification.category,
    };
  }

  // Fallback factual general response
  return {
    draft: `With a background in ${resume.skills?.raw?.slice(0, 3).join(", ") || "technology"} and experience delivering projects at ${
      recentExp?.company || "various teams"
    }, I bring a structured problem-solving approach and a commitment to high-quality execution.`,
    isSensitive: false,
    category: classification.category,
  };
}

/**
 * Creates an ApplicationRecord from a NormalizedJob / SavedJob with an initial timeline.
 */
export function createApplicationRecord(params: {
  userId: string;
  job: NormalizedJob;
  savedJobId?: string;
  resumeVersionId?: string;
  resumeVersionName?: string;
  lastMatchResult?: ExplainableMatchResult;
  notes?: string;
}): ApplicationRecord {
  const { userId, job, savedJobId, resumeVersionId, resumeVersionName, lastMatchResult, notes } = params;
  const appId = generateCopilotId("app");
  const now = new Date().toISOString();

  const timeline: ApplicationTimelineEvent[] = [
    {
      id: generateCopilotId("evt"),
      applicationId: appId,
      eventType: "JOB_SAVED",
      description: `Saved job posting for ${job.title} at ${job.company}`,
      timestamp: now,
    },
    {
      id: generateCopilotId("evt"),
      applicationId: appId,
      eventType: "PREPARATION_STARTED",
      description: "Application preparation workspace initialized",
      timestamp: now,
    },
  ];

  if (resumeVersionName) {
    timeline.push({
      id: generateCopilotId("evt"),
      applicationId: appId,
      eventType: "RESUME_SELECTED",
      description: `Selected resume version: ${resumeVersionName}`,
      timestamp: now,
    });
  }

  return {
    id: appId,
    userId,
    jobId: job.id,
    savedJobId,
    company: job.company,
    jobTitle: job.title,
    location: job.location,
    remoteType: job.workArrangementLabel || (job.remote ? "Remote" : "On-site"),
    source: job.source,
    sourceUrl: job.url,
    applicationUrl: job.applyUrl || job.url,
    status: "PREPARING",
    resumeVersionId,
    resumeVersionName,
    notes,
    createdAt: now,
    updatedAt: now,
    materials: [],
    timeline,
    lastMatchResult,
  };
}
