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
 *
 * Fix #4: The previous implementation fell through to `return false` for
 * all non-exact normalized pairs, breaking PARTIAL detection for synonyms
 * like "postgres" → "postgresql" and "react.js" → "react".
 *
 * Resolution order:
 *   1. Exact normalized match.
 *   2. Canonical alias: both normalize to the same canonical form.
 *   3. Strict guard: unrelated similar-looking technologies remain false.
 *
 * Unrelated technologies (Java≠JavaScript, Python≠PyTorch, etc.) are
 * kept strictly separate via guard checks.
 */
export function areSkillsEquivalent(skillA: string, skillB: string): boolean {
  if (!skillA || !skillB) return false;
  const normA = normalizeSkill(skillA);
  const normB = normalizeSkill(skillB);

  // 1. Exact canonical match
  if (normA === normB) return true;

  // 2. Strict non-match guards — must come before any fuzzy logic
  const guards: [string, string][] = [
    ["java", "javascript"],
    ["python", "pytorch"],
    ["sql", "postgresql"],
    ["sql", "mysql"],
    ["c", "c++"],
    ["c", "c#"],
    ["c", "cicd"],
    ["r", "rust"],
    ["r", "ruby"],
    ["go", "golang"],  // already aliased, but guard prevents false-alias chains
  ];

  for (const [x, y] of guards) {
    if ((normA === x && normB === y) || (normA === y && normB === x)) {
      return false;
    }
  }

  // 3. Both normalized through CANONICAL_ALIASES to the same canonical form
  //    e.g. "Postgres" → "postgresql" and "postgres" → "postgresql" → match
  //         "ReactJS" → "react" and "React.js" → "react" → match
  //    (This is the case the old code missed — both sides already normalized
  //    above, so if normA === normB this was caught in step 1. However,
  //    an alias chain where one side is already canonical and the other
  //    normalizes to it is caught here by comparing against the alias values.)
  const aliasOfA = CANONICAL_ALIASES[normA];
  const aliasOfB = CANONICAL_ALIASES[normB];

  // A is an alias key and B is the canonical value for that alias
  if (aliasOfA && aliasOfA === normB) return true;
  // B is an alias key and A is the canonical value for that alias
  if (aliasOfB && aliasOfB === normA) return true;
  // Both are alias keys pointing to the same canonical value
  if (aliasOfA && aliasOfB && aliasOfA === aliasOfB) return true;

  return false;
}

/**
 * Implicit skill implication graph for EVIDENCE_GAP detection.
 *
 * Fix #13: Expands evidence-gap inference beyond the single hardcoded
 * Next.js → React relationship. Each entry maps a "proved" skill (on the
 * candidate's resume) to a "required" skill that the proved skill
 * strongly implies — but does NOT confirm — proficiency in.
 *
 * Rules:
 *   - Pairs are defensible and widely accepted in the industry.
 *   - Implication is one-directional only (having Next.js implies React
 *     knowledge; having React does NOT imply Next.js).
 *   - Inferred skills are labelled EVIDENCE_GAP, never MATCHED.
 *   - The candidate may genuinely lack the required skill; these are gaps
 *     to address, not confirmations to award.
 */
const IMPLICIT_SKILL_GRAPH: Map<string, string[]> = new Map([
  // Framework → core language or library
  ["next.js",      ["react"]],
  ["nuxt.js",      ["vue"]],
  ["remix",        ["react"]],
  ["gatsby",       ["react"]],
  ["spring boot",  ["java", "spring"]],
  ["django",       ["python"]],
  ["flask",        ["python"]],
  ["fastapi",      ["python"]],
  ["rails",        ["ruby"]],
  ["laravel",      ["php"]],
  // Container orchestration → containerisation
  ["kubernetes",   ["docker"]],
  // Testing frameworks → the underlying language/runtime
  ["jest",         ["javascript", "typescript"]],
  ["pytest",       ["python"]],
  // ORM → SQL literacy
  ["prisma",       ["sql"]],
  ["sqlalchemy",   ["sql", "python"]],
  ["typeorm",      ["sql", "typescript"]],
]);

/**
 * Checks if the candidate has any skills that imply proficiency in `target`.
 * Returns the implying skill if found, or null.
 */
function findImpliedEvidence(
  targetNorm: string,
  candidateAllTech: string[]
): string | null {
  for (const [provingSkill, impliedSkills] of IMPLICIT_SKILL_GRAPH) {
    if (impliedSkills.includes(targetNorm)) {
      if (candidateAllTech.includes(provingSkill) || candidateAllTech.includes(normalizeSkill(provingSkill))) {
        return provingSkill;
      }
    }
  }
  return null;
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
 *
 * Optimization #19: requirements are deduplicated by normalizedSkill before
 * processing to avoid redundant regex scans from duplicate job postings.
 * Capped at 60 unique requirements to bound worst-case regex complexity.
 */
export function analyzeJobMatch(params: {
  job: NormalizedJob;
  resume: CanonicalResume;
  resumeVersionName?: string;
  userTargetRole?: string;
}): ExplainableMatchResult {
  const { job, resume, resumeVersionName = "Active Resume", userTargetRole } = params;

  // Deduplication + cap (Optimization #19)
  const seen = new Set<string>();
  const allRequirements = [...job.requirements, ...job.preferredQualifications]
    .filter((req) => {
      const key = req.normalizedSkill || req.text.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 60); // cap at 60 unique requirements

  const dimensions: MatchDimension[] = [];
  const skillGaps: SkillGapItem[] = [];

  const stronglySupported: string[] = [];
  const partiallySupported: string[] = [];
  const evidenceGaps: string[] = [];
  const missing: string[] = [];
  const unknown: string[] = [];

  // Pre-compute candidate tech list once (used in evidence-gap check per requirement)
  const candidateAllTech = [
    ...(resume.skills?.raw || []),
    ...(resume.skills?.categorized?.frameworks || []),
    ...(resume.skills?.categorized?.languages || []),
    ...(resume.skills?.categorized?.databases || []),
    ...(resume.skills?.categorized?.cloud || []),
    ...(resume.skills?.categorized?.tools || []),
  ].map((s) => normalizeSkill(s));

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
      // Check implicit skill graph for evidence-gap inference (Fix #13)
      const targetNorm = normalizeSkill(skillToLookFor);
      const implyingSkill = findImpliedEvidence(targetNorm, candidateAllTech);

      if (implyingSkill) {
        status = "EVIDENCE_GAP";
        confidence = 0.6;
        evidenceGaps.push(skillToLookFor);
        reason = `Your resume includes ${implyingSkill}, which strongly implies ${skillToLookFor} experience, but ${skillToLookFor} is not explicitly highlighted in your work or project bullets.`;
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
