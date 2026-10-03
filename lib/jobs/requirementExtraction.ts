/**
 * lib/jobs/requirementExtraction.ts
 *
 * UBIX Job Requirement Extraction & Normalization
 *
 * Normalizes raw, heterogeneous job postings into a canonical, structured schema.
 * Preserves source integrity, identifies required vs preferred skills,
 * and extracts verifiable accessibility accommodations without speculation.
 */

import { normalizeSkillName } from "../career/skillGraph";

export interface NormalizedJobRequirement {
  id: string;
  sourceId: string;
  sourceProvider: string;
  title: string;
  role: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";
  requiredSkills: string[];
  preferredSkills: string[];
  minimumYearsExperience: number | "UNKNOWN";
  educationRequirement: string;
  responsibilities: string[];
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
    interval: "YEARLY" | "MONTHLY" | "HOURLY";
  };
  accessibilityClaims: string[];
  applicationDeadline?: string;
  postedAt: string;
  extractedAt: string;
  rawTextExcerpt: string;
  freshnessStatus: "FRESH" | "STALE" | "EXPIRED";
}

/**
 * Normalizes raw posting input into canonical NormalizedJobRequirement schema.
 */
export function extractAndNormalizeJobPosting(input: {
  id: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  sourceProvider: string;
  postedAt?: string;
  deadline?: string;
  rawSalary?: { min?: number; max?: number; currency?: string };
}): NormalizedJobRequirement {
  const text = input.description.toLowerCase();

  // 1. Work Mode detection
  let workMode: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN" = "UNKNOWN";
  if (text.includes("remote") || text.includes("work from home") || text.includes("anywhere")) {
    workMode = "REMOTE";
  } else if (text.includes("hybrid") || text.includes("flexible")) {
    workMode = "HYBRID";
  } else if (text.includes("on-site") || text.includes("in-office") || text.includes("relocation")) {
    workMode = "ONSITE";
  }

  // 2. Experience extraction
  let minimumYearsExperience: number | "UNKNOWN" = "UNKNOWN";
  const expMatch = input.description.match(/(\d+)\+?\s*(?:to\s*\d+\s*)?(?:years?|yrs?)\s*(?:of\s*)?experience/i);
  if (expMatch && expMatch[1]) {
    const parsed = parseInt(expMatch[1], 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 30) {
      minimumYearsExperience = parsed;
    }
  }

  // 3. Known Skill extraction with canonical normalization
  const candidateSkills = [
    "TypeScript", "JavaScript", "Python", "Go", "Java", "C++", "C#", "Rust",
    "React", "Next.js", "Node.js", "Docker", "Kubernetes", "PostgreSQL", "MongoDB",
    "Redis", "AWS", "GCP", "Azure", "GraphQL", "REST", "SQL", "Git", "Linux",
    "Tailwind CSS", "HTML5", "CSS3", "CI/CD", "Kafka", "Elasticsearch"
  ];

  const requiredSkills: string[] = [];
  const preferredSkills: string[] = [];

  const lines = input.description.split("\n");

  candidateSkills.forEach((skill) => {
    const norm = normalizeSkillName(skill);
    const regex = new RegExp(`\\b${norm.replace(".", "\\.")}\\b`, "i");

    for (const line of lines) {
      if (regex.test(line)) {
        const lineLower = line.toLowerCase();
        if (
          lineLower.includes("preferred") ||
          lineLower.includes("plus") ||
          lineLower.includes("nice to have")
        ) {
          preferredSkills.push(skill);
        } else {
          requiredSkills.push(skill);
        }
        break;
      }
    }
  });

  // 4. Accessibility claims extraction (Strict factual detection: only when explicitly stated)
  const accessibilityClaims: string[] = [];
  if (text.includes("equal opportunity") || text.includes("eeo")) {
    accessibilityClaims.push("Explicit EEO Employer statement");
  }
  if (text.includes("reasonable accommodation") || text.includes("accommodations available")) {
    accessibilityClaims.push("Explicit accommodations request process available");
  }
  if (text.includes("screen reader") || text.includes("accessible application process")) {
    accessibilityClaims.push("Accessible application portal claims");
  }

  // 5. Freshness evaluation
  const postedDate = input.postedAt ? new Date(input.postedAt) : new Date();
  const daysDiff = (Date.now() - postedDate.getTime()) / (1000 * 60 * 60 * 24);
  let freshnessStatus: "FRESH" | "STALE" | "EXPIRED" = "FRESH";
  if (daysDiff > 60) {
    freshnessStatus = "EXPIRED";
  } else if (daysDiff > 30) {
    freshnessStatus = "STALE";
  }

  // 6. Education requirement
  let educationRequirement = "UNKNOWN";
  if (text.includes("bachelor") || text.includes("bs in") || text.includes("ba in")) {
    educationRequirement = "Bachelor's Degree or Equivalent";
  } else if (text.includes("master") || text.includes("ms in")) {
    educationRequirement = "Master's Degree";
  } else if (text.includes("phd") || text.includes("doctorate")) {
    educationRequirement = "Ph.D.";
  }

  return {
    id: `req_${input.id}`,
    sourceId: input.id,
    sourceProvider: input.sourceProvider,
    title: input.title,
    role: input.title,
    company: input.company,
    location: input.location || "UNKNOWN",
    workMode,
    requiredSkills: Array.from(new Set(requiredSkills)),
    preferredSkills: Array.from(new Set(preferredSkills)),
    minimumYearsExperience,
    educationRequirement,
    responsibilities: input.description.split("\n").filter((l) => l.trim().startsWith("-") || l.trim().startsWith("•")),
    salaryRange: input.rawSalary?.min
      ? {
          min: input.rawSalary.min,
          max: input.rawSalary.max || input.rawSalary.min,
          currency: input.rawSalary.currency || "USD",
          interval: "YEARLY",
        }
      : undefined,
    accessibilityClaims,
    applicationDeadline: input.deadline,
    postedAt: input.postedAt || new Date().toISOString(),
    extractedAt: new Date().toISOString(),
    rawTextExcerpt: input.description.substring(0, 500),
    freshnessStatus,
  };
}
