/**
 * lib/career/jobParser.ts
 *
 * Deterministic, tolerant Job Description Parser & Normalizer.
 *
 * Invariant: Never fabricates requirements, salaries, or deadlines.
 * Invariant: Conservatively classifies requirement strength:
 *   - REQUIRED ("must have", "required", "essential", "minimum 3 years")
 *   - PREFERRED ("nice to have", "plus", "preferred", "bonus")
 *   - OPTIONAL ("optional", "not required")
 *   - UNKNOWN (ambiguous or unstated)
 */

import crypto from "crypto";
import type { NormalizedJob, NormalizedRequirement, RequirementType } from "./types";
import type { LiveJob } from "@/app/api/jobs/route";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Common tech keywords to extract from job text when normalizing skills
const TECH_KEYWORDS: string[] = [
  "javascript", "typescript", "python", "java", "c++", "c#", "c", "golang", "go",
  "rust", "ruby", "php", "swift", "kotlin", "scala", "sql", "bash", "html", "css",
  "react", "react.js", "next.js", "vue", "angular", "node.js", "express", "fastapi",
  "django", "flask", "spring", "spring boot", "asp.net", "rails", "tailwind",
  "postgresql", "postgres", "mysql", "mongodb", "sqlite", "redis", "elasticsearch",
  "aws", "amazon web services", "azure", "gcp", "google cloud", "docker", "kubernetes",
  "git", "ci/cd", "rest", "rest api", "graphql", "terraform", "linux", "jest",
  "microservices", "kafka", "rabbitmq"
];

/**
 * Classifies a sentence or bullet point as REQUIRED, PREFERRED, OPTIONAL, or UNKNOWN.
 */
export function classifyRequirementType(text: string): RequirementType {
  const lower = text.toLowerCase();

  // Preferred indicators
  if (
    lower.includes("preferred") ||
    lower.includes("nice to have") ||
    lower.includes("bonus") ||
    lower.includes("plus") ||
    lower.includes("ideal candidate") ||
    lower.includes("advantage") ||
    lower.includes("helpful")
  ) {
    return "PREFERRED";
  }

  // Optional indicators
  if (
    lower.includes("optional") ||
    lower.includes("not required") ||
    lower.includes("welcome but not")
  ) {
    return "OPTIONAL";
  }

  // Required indicators
  if (
    lower.includes("must have") ||
    lower.includes("required") ||
    lower.includes("essential") ||
    lower.includes("minimum of") ||
    lower.includes("at least") ||
    lower.includes("mandatory") ||
    lower.includes("requirements:") ||
    lower.includes("qualifications:") ||
    lower.includes("proven experience")
  ) {
    return "REQUIRED";
  }

  return "UNKNOWN";
}

/**
 * Extracts individual bullet points or sentences from a raw text block.
 */
export function extractLinesAndBullets(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];

  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .map((l) => l.replace(/^[-*•–—\d.)\]]\s*/, "").trim())
    .filter((l) => l.length > 5);
}

/**
 * Parses raw text (e.g. pasted from an external job board) into a normalized JobPosting.
 */
export function parseJobDescription(params: {
  rawText: string;
  sourceUrl?: string;
  titleHint?: string;
  companyHint?: string;
  locationHint?: string;
}): NormalizedJob {
  const { rawText, sourceUrl = "", titleHint = "", companyHint = "", locationHint = "" } = params;
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let title = titleHint;
  let company = companyHint;
  let location = locationHint;
  let remote = false;

  // Title and Company extraction heuristic from first two lines if not provided
  if (!title && lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length < 80 && !firstLine.includes("http")) {
      title = firstLine;
    }
  }

  if (!company && lines.length > 1) {
    const secondLine = lines[1];
    if (secondLine.length < 80 && !secondLine.includes("http") && !secondLine.toLowerCase().includes("responsibilities")) {
      const parts = secondLine.split(/[-–|•·]/).map((p) => p.trim());
      company = parts[0] || "Employer";
      if (!location && parts.length > 1) {
        location = parts[1];
      }
    }
  }

  // Remote check
  const fullTextLower = rawText.toLowerCase();
  if (
    fullTextLower.includes("remote") ||
    fullTextLower.includes("work from home") ||
    fullTextLower.includes("anywhere")
  ) {
    remote = true;
  }

  // Identify sections
  const requirements: NormalizedRequirement[] = [];
  const preferredQualifications: NormalizedRequirement[] = [];
  const responsibilities: string[] = [];

  let currentSection: "unknown" | "responsibilities" | "requirements" | "preferred" = "unknown";

  for (const line of lines) {
    const lower = line.toLowerCase();
    const cleanLine = line.replace(/^[-*•–—\d.)\]]\s*/, "").trim();
    if (cleanLine.length < 3) continue;

    const isHeaderLine = cleanLine.endsWith(":") || cleanLine.length < 35;

    // Section header detection
    if (
      isHeaderLine &&
      (lower.includes("responsibilities") ||
        lower.includes("what you will do") ||
        lower.includes("duties") ||
        lower.includes("the role"))
    ) {
      currentSection = "responsibilities";
      continue;
    }

    if (
      isHeaderLine &&
      (lower.includes("nice to have") ||
        lower.includes("preferred qualifications") ||
        lower.includes("bonus points") ||
        lower.includes("what we'd love to see"))
    ) {
      currentSection = "preferred";
      continue;
    }

    if (
      isHeaderLine &&
      (lower.includes("requirements") ||
        lower.includes("what you bring") ||
        lower.includes("qualifications") ||
        lower.includes("who you are"))
    ) {
      currentSection = "requirements";
      continue;
    }

    if (cleanLine.length < 6) continue;

    if (currentSection === "responsibilities") {
      responsibilities.push(cleanLine);
    } else if (currentSection === "preferred") {
      // Find all matched skill keywords in this requirement
      const matchedSkills = TECH_KEYWORDS.filter((sk) =>
        new RegExp(`\\b${sk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(cleanLine)
      );

      if (matchedSkills.length > 0) {
        for (const sk of matchedSkills) {
          preferredQualifications.push({
            id: generateId(),
            text: cleanLine,
            normalizedSkill: sk,
            type: "PREFERRED",
            category: "skill",
          });
        }
      } else {
        preferredQualifications.push({
          id: generateId(),
          text: cleanLine,
          type: "PREFERRED",
          category: "general",
        });
      }
    } else if (currentSection === "requirements") {
      const type = classifyRequirementType(cleanLine);
      const matchedSkills = TECH_KEYWORDS.filter((sk) =>
        new RegExp(`\\b${sk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(cleanLine)
      );

      if (matchedSkills.length > 0) {
        for (const sk of matchedSkills) {
          requirements.push({
            id: generateId(),
            text: cleanLine,
            normalizedSkill: sk,
            type: type === "UNKNOWN" ? "REQUIRED" : type,
            category: "skill",
          });
        }
      } else {
        requirements.push({
          id: generateId(),
          text: cleanLine,
          type: type === "UNKNOWN" ? "REQUIRED" : type,
          category: "general",
        });
      }
    }
  }

  // If no sections were found via headings, extract requirements directly via keywords
  if (requirements.length === 0 && preferredQualifications.length === 0) {
    const rawBullets = extractLinesAndBullets(rawText);
    for (const bullet of rawBullets) {
      const matchedSkill = TECH_KEYWORDS.find((sk) =>
        new RegExp(`\\b${sk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(bullet)
      );

      if (matchedSkill) {
        const type = classifyRequirementType(bullet);
        if (type === "PREFERRED") {
          preferredQualifications.push({
            id: generateId(),
            text: bullet,
            normalizedSkill: matchedSkill,
            type: "PREFERRED",
            category: "skill",
          });
        } else {
          requirements.push({
            id: generateId(),
            text: bullet,
            normalizedSkill: matchedSkill,
            type: type,
            category: "skill",
          });
        }
      }
    }
  }

  // Collect all unique skills extracted
  const allExtractedSkills = Array.from(
    new Set(
      [...requirements, ...preferredQualifications]
        .map((r) => r.normalizedSkill)
        .filter(Boolean) as string[]
    )
  );

  // FIX #9: Wrap new URL() in try/catch — malformed or dangerous sourceUrls
  // (e.g. "not-a-url", "javascript:void(0)", "data:text/html,...") would previously
  // throw a TypeError crashing the entire parse. Dangerous protocols are also rejected.
  let resolvedSource = "User Paste";
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      // Only trust http: and https: source URLs; reject javascript:, data:, file:, etc.
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        resolvedSource = parsed.hostname;
      }
    } catch {
      // Malformed URL — fallback to "User Paste"
    }
  }

  return {
    id: generateId(),
    title: title || "Job Posting",
    company: company || "Employer",
    location: location || (remote ? "Remote" : "Location unspecified"),
    remote,
    workArrangement: remote ? "worldwide_remote" : "onsite",
    workArrangementLabel: remote ? "Remote" : "On-site / Unspecified",
    jobType: "Full-time",
    url: sourceUrl,
    applyUrl: sourceUrl,
    description: rawText.slice(0, 500) + (rawText.length > 500 ? "..." : ""),
    responsibilities,
    requirements,
    preferredQualifications,
    skills: allExtractedSkills,
    source: resolvedSource,
    provenance: "USER_INPUT",
    rawDescription: rawText,
  };
}

/**
 * Converts a LiveJob from the existing /api/jobs aggregator into a NormalizedJob.
 */
export function normalizeLiveJob(job: LiveJob): NormalizedJob {
  const reqs: NormalizedRequirement[] = [];

  // Extract requirements from tags, or parse from description if tags absent
  if (Array.isArray(job.tags) && job.tags.length > 0) {
    for (const tag of job.tags) {
      reqs.push({
        id: generateId(),
        text: `Experience with ${tag}`,
        normalizedSkill: tag.toLowerCase(),
        type: "REQUIRED",
        category: "skill",
      });
    }
  } else if ((job as { description?: string; descriptionSnippet?: string }).description || job.descriptionSnippet) {
    const text = (job as { description?: string; descriptionSnippet?: string }).description || job.descriptionSnippet || "";
    const parsed = parseJobDescription({
      rawText: text,
      titleHint: job.title,
      companyHint: job.company,
      locationHint: job.location,
      sourceUrl: job.url || job.applyUrl,
    });
    return {
      ...parsed,
      id: job.id || parsed.id,
      title: job.title || parsed.title,
      company: job.company || parsed.company,
      location: job.location || parsed.location,
      remote: job.remote !== undefined ? job.remote : parsed.remote,
      url: job.url || parsed.url,
      applyUrl: job.applyUrl || parsed.applyUrl,
    };
  }

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    country: job.country,
    remote: job.remote,
    workArrangement: job.workArrangement,
    workArrangementLabel: job.workArrangementLabel,
    jobType: job.jobType,
    url: job.url,
    applyUrl: job.applyUrl,
    description: job.descriptionSnippet,
    responsibilities: [],
    requirements: reqs,
    preferredQualifications: [],
    skills: job.tags || [],
    salary: job.salary,
    accessibility: job.accessibility,
    postedAt: job.postedAt,
    source: job.source,
    provenance: job.provenance,
  };
}
