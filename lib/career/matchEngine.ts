/**
 * lib/career/matchEngine.ts
 *
 * Deterministic, Explainable Match & Evidence Engine.
 *
 * Implements:
 * 1. Conservative skill equivalence normalization (React == React.js, PostgreSQL == Postgres,
 *    C++ == C plus plus, but Java != JavaScript, Python != PyTorch, SQL != PostgreSQL).
 * 2. Verbatim Resume Evidence Extraction (searches CanonicalResume sections: skills, work experience,
 *    projects, education, certifications).
 * 3. Exact Distinction between:
 *    - MATCHED: Clear evidence found in candidate's structured resume.
 *    - PARTIAL: Listed only in skills array without concrete project/work bullet points.
 *    - EVIDENCE_GAP: Candidate demonstrates related domain/stack (e.g. Next.js implies React),
 *      but lacks an explicit bullet. Candidate may possess the skill, but resume does not showcase it.
 *    - MISSING: Genuine requirement with zero evidence anywhere in resume.
 *    - UNKNOWN: Ambiguous requirement or unstated requirement details in posting.
 * 4. Transparent, explainable Application Readiness checklist.
 *
 * Invariant: Never fabricates evidence or predicts hiring outcomes.
 */

import type { CanonicalResume } from "@/lib/resume/structuredParser";
import type {
  NormalizedJob,
  NormalizedRequirement,
  MatchDimension,
  MatchStatus,
  ExplainableMatchResult,
  SkillGapItem,
  ApplicationReadiness,
  ApplicationReadinessCheck,
} from "./types";

// ─── Conservative Equivalence Dictionary ──────────────────────────────────────────
// Maps skill variations to their canonical representation.
// Note: Java != JavaScript, Python != PyTorch, SQL != PostgreSQL.
const CANONICAL_ALIASES: Record<string, string> = {
  "react.js": "react",
  "reactjs": "react",
  "nextjs": "next.js",
  "node": "node.js",
  "nodejs": "node.js",
  "vuejs": "vue",
  "vue.js": "vue",
  "angularjs": "angular",
  "postgres": "postgresql",
  "amazon web services": "aws",
  "google cloud platform": "gcp",
  "google cloud": "gcp",
  "microsoft azure": "azure",
  "c plus plus": "c++",
  "c sharp": "c#",
  "golang": "go",
  "tailwind": "tailwind css",
  "tailwindcss": "tailwind css",
  "restful": "rest",
  "restful api": "rest",
  "rest api": "rest",
  "ci/cd": "cicd",
};

/**
 * Normalizes a skill string to its conservative canonical root.
 */
export function normalizeSkill(skill: string): string {
  if (!skill) return "";
  const cleaned = skill.trim().toLowerCase();
  return CANONICAL_ALIASES[cleaned] || cleaned;
}

/**
 * Checks if two skills match with conservative boundaries.
 * Enforces strict non-matches:
 * - Java !== JavaScript
 * - Python !== PyTorch
 * - SQL !== PostgreSQL
 */
export function areSkillsEquivalent(skillA: string, skillB: string): boolean {
  const normA = normalizeSkill(skillA);
  const normB = normalizeSkill(skillB);

  if (normA === normB) return true;

  // Strict guardrails
  const guards = [
    ["java", "javascript"],
    ["python", "pytorch"],
    ["sql", "postgresql"],
    ["c", "c++"],
    ["c", "c#"],
    ["r", "rust"],
  ];

  for (const [x, y] of guards) {
    if ((normA === x && normB === y) || (normA === y && normB === x)) {
      return false;
    }
  }

  return false;
}

/**
 * Searches CanonicalResume for verbatim evidence supporting a required skill or keyword.
 */
export function findResumeEvidence(
  skillOrKeyword: string,
  resume: CanonicalResume
): { found: boolean; where: "work" | "project" | "skill_only" | "education" | "cert" | null; snippet: string } {
  const targetNorm = normalizeSkill(skillOrKeyword);
  if (!targetNorm) return { found: false, where: null, snippet: "" };

  const regex = new RegExp(`\\b${targetNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

  // 1. Check Work Experience Bullets (Highest Evidence Value)
  if (Array.isArray(resume.work)) {
    for (const exp of resume.work) {
      if (exp.bullets && regex.test(exp.bullets)) {
        // Extract the specific sentence or bullet
        const lines = exp.bullets.split(/\r?\n|•|\. /);
        const matchLine = lines.find((l) => regex.test(l));
        return {
          found: true,
          where: "work",
          snippet: `[${exp.company} - ${exp.role}] "${(matchLine || exp.bullets).trim().slice(0, 160)}"`,
        };
      }
    }
  }

  // 2. Check Projects (High Evidence Value)
  if (Array.isArray(resume.projects)) {
    for (const proj of resume.projects) {
      if (
        (proj.techStack && regex.test(proj.techStack)) ||
        (proj.description && regex.test(proj.description))
      ) {
        return {
          found: true,
          where: "project",
          snippet: `[Project: ${proj.title}] "${proj.description ? proj.description.slice(0, 140) : proj.techStack}"`,
        };
      }
    }
  }

  // 3. Check Certifications
  if (Array.isArray(resume.certifications)) {
    for (const cert of resume.certifications) {
      if (cert.name && regex.test(cert.name)) {
        return {
          found: true,
          where: "cert",
          snippet: `[Certification] ${cert.name} (${cert.issuer || ""})`,
        };
      }
    }
  }

  // 4. Check Skills List (Partial Evidence Value)
  const allSkills = [
    ...(resume.skills?.raw || []),
    ...(resume.skills?.categorized?.languages || []),
    ...(resume.skills?.categorized?.frameworks || []),
    ...(resume.skills?.categorized?.databases || []),
    ...(resume.skills?.categorized?.cloud || []),
    ...(resume.skills?.categorized?.tools || []),
  ];

  const matchedSkill = allSkills.find((s) => areSkillsEquivalent(s, targetNorm));
  if (matchedSkill) {
    return {
      found: true,
      where: "skill_only",
      snippet: `Listed in skills section as "${matchedSkill}" (No project/work bullet detected)`,
    };
  }

  return { found: false, where: null, snippet: "" };
}

/**
 * Executes explainable matching between a CanonicalResume and a NormalizedJob.
 */
export function analyzeJobMatch(params: {
  job: NormalizedJob;
  resume: CanonicalResume;
  resumeVersionName?: string;
  userTargetRole?: string;
}): ExplainableMatchResult {
  const { job, resume, resumeVersionName = "Active Resume", userTargetRole } = params;

  const allRequirements = [...job.requirements, ...job.preferredQualifications];
  const dimensions: MatchDimension[] = [];
  const skillGaps: SkillGapItem[] = [];

  const stronglySupported: string[] = [];
  const partiallySupported: string[] = [];
  const evidenceGaps: string[] = [];
  const missing: string[] = [];
  const unknown: string[] = [];

  for (const req of allRequirements) {
    const skillToLookFor = req.normalizedSkill || req.text;
    const evidence = findResumeEvidence(skillToLookFor, resume);

    let status: MatchStatus = "UNKNOWN";
    let reason = "";
    let confidence = 0.5;

    if (evidence.found) {
      if (evidence.where === "work" || evidence.where === "project" || evidence.where === "cert") {
        status = "MATCHED";
        confidence = 0.95;
        stronglySupported.push(req.normalizedSkill || req.text);
      } else {
        // Listed in skills section without work/project bullet
        status = "PARTIAL";
        confidence = 0.7;
        partiallySupported.push(req.normalizedSkill || req.text);
        reason = "Skill is declared on your resume, but without project or work achievement bullets.";
      }
    } else {
      // Check if candidate has closely related technology (Evidence Gap)
      const candidateAllTech = [
        ...(resume.skills?.raw || []),
        ...(resume.skills?.categorized?.frameworks || []),
        ...(resume.skills?.categorized?.languages || []),
      ].map((s) => normalizeSkill(s));

      const isNextCandidate = candidateAllTech.includes("next.js");
      const isReactReq = normalizeSkill(skillToLookFor) === "react";

      if (isNextCandidate && isReactReq) {
        status = "EVIDENCE_GAP";
        confidence = 0.6;
        evidenceGaps.push(skillToLookFor);
        reason = "You showcase Next.js projects, which heavily implies React knowledge, but React is not explicitly highlighted in your experience bullets.";
      } else if (req.type === "UNKNOWN") {
        status = "UNKNOWN";
        confidence = 0.3;
        unknown.push(req.text);
        reason = "Posting does not state exact quantifiable requirements for this criteria.";
      } else {
        status = "MISSING";
        confidence = 0.9;
        missing.push(skillToLookFor);
        reason = "No supporting evidence found across skills, work history, or projects.";
      }
    }

    dimensions.push({
      requirement: req,
      status,
      evidence: evidence.snippet || undefined,
      reason: reason || undefined,
      confidence,
    });

    // If it's a gap (MISSING, PARTIAL, or EVIDENCE_GAP), create an actionable gap item
    if (status === "MISSING" || status === "PARTIAL" || status === "EVIDENCE_GAP") {
      let actionRecommendation = "";
      if (status === "EVIDENCE_GAP") {
        actionRecommendation = `You have related experience. Add an explicit mention or bullet showing your hands-on use of ${skillToLookFor}.`;
      } else if (status === "PARTIAL") {
        actionRecommendation = `Back up "${skillToLookFor}" with a measurable project achievement or work responsibility bullet in your resume.`;
      } else {
        actionRecommendation = `If you have genuine experience with ${skillToLookFor}, consider adding it. Otherwise, build familiarity before applying.`;
      }

      skillGaps.push({
        skill: req.normalizedSkill || req.text,
        importance: req.type,
        status,
        actionRecommendation,
      });
    }
  }

  // ─── Application Readiness Generation ──────────────────────────────────────────
  const checks: ApplicationReadinessCheck[] = [];

  // Check 1: Resume Contact Basics
  const hasBasics = Boolean(resume.basics?.name && (resume.basics?.email || resume.basics?.phone));
  checks.push({
    id: "resume-basics",
    label: "Contact & Basic Profile Information",
    status: hasBasics ? "ready" : "needs_attention",
    details: hasBasics
      ? "Full contact information is complete."
      : "Ensure your name and valid contact details are populated.",
  });

  // Check 2: Core Required Skills
  const requiredCount = job.requirements.filter((r) => r.type === "REQUIRED").length;
  const matchedRequiredCount = dimensions.filter(
    (d) => d.requirement.type === "REQUIRED" && d.status === "MATCHED"
  ).length;

  const reqRatio = requiredCount > 0 ? matchedRequiredCount / requiredCount : 1;
  checks.push({
    id: "core-skills",
    label: "Core Required Skills Evidence",
    status: reqRatio >= 0.75 ? "ready" : reqRatio >= 0.4 ? "needs_attention" : "optional",
    details: `${matchedRequiredCount} of ${requiredCount} required skills have verified evidence in your resume.`,
  });

  // Check 3: Application Link
  checks.push({
    id: "apply-link",
    label: "Direct Employer / Application URL",
    status: job.applyUrl || job.url ? "ready" : "optional",
    details: job.applyUrl || job.url ? "Verified application destination available." : "Apply link not found in posting.",
  });

  const isReady = hasBasics && reqRatio >= 0.5;
  const preparationSteps: string[] = [];

  if (evidenceGaps.length > 0) {
    preparationSteps.push(
      `Clarify your implicit experience: Add explicit evidence for ${evidenceGaps.slice(0, 3).join(", ")} to your resume.`
    );
  }
  if (missing.length > 0) {
    preparationSteps.push(
      `Review required gaps: Evaluate if you can speak to ${missing.slice(0, 3).join(", ")} or need preparation.`
    );
  }
  if (partiallySupported.length > 0) {
    preparationSteps.push(
      `Strengthen bullets: Attach measurable achievements to ${partiallySupported.slice(0, 2).join(", ")}.`
    );
  }
  if (preparationSteps.length === 0) {
    preparationSteps.push("Your resume matches all identified criteria. Review the original employer link and submit when ready.");
  }

  const applicationReadiness: ApplicationReadiness = {
    isReady,
    scoreExplanation: `${matchedRequiredCount}/${requiredCount} core requirements supported with factual evidence.`,
    checks,
    preparationSteps,
  };

  // Human-readable why summary
  const whyExplanation =
    stronglySupported.length > 0
      ? `Strong factual support found for ${stronglySupported.slice(0, 4).join(", ")} in your work experience and projects.${
          missing.length > 0
            ? ` Notice that ${missing.slice(0, 2).join(", ")} is listed in the posting but no supporting evidence was detected.`
            : " All core technologies have supporting evidence."
        }`
      : "Limited matching evidence detected between this posting's requirements and your current resume.";

  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    resumeVersionUsed: resumeVersionName,
    analyzedAt: new Date().toISOString(),
    dimensions,
    summary: {
      stronglySupported,
      partiallySupported,
      evidenceGaps,
      missing,
      unknown,
    },
    skillGaps,
    applicationReadiness,
    whyExplanation,
    provenanceNotice: `Provenance: ${job.provenance} from ${job.source}. Analysis generated deterministically without factual extrapolation.`,
  };
}
