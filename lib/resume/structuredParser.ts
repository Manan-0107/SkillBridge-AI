/**
 * lib/resume/structuredParser.ts
 *
 * Tolerant, deterministic resume text extractor.
 * Converts unstructured plain text from PDFs, Word documents, or text pastes
 * into canonical structured resume objects.
 *
 * Invariant: Never hallucinates facts. If a section or field cannot be confidently
 * extracted, it is left empty or as an empty list.
 */

export interface StructuredBasics {
  name: string;
  headline?: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  summary: string;
}

export interface StructuredExperience {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string;
}

export interface StructuredEducation {
  id: string;
  institution: string;
  degree: string;
  location: string;
  graduationYear: string;
  gpaOrHonors: string;
}

export interface StructuredProject {
  id: string;
  title: string;
  techStack: string;
  liveUrl: string;
  repoUrl: string;
  description: string;
}

export interface StructuredSkills {
  raw: string[];
  categorized: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloud: string[];
    tools: string[];
    other: string[];
  };
}

export interface StructuredCertification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  linkOrId: string;
}

export interface CanonicalResume {
  basics: StructuredBasics;
  skills: StructuredSkills;
  work: StructuredExperience[];
  education: StructuredEducation[];
  projects: StructuredProject[];
  certifications: StructuredCertification[];
}

// ─── Skill Classification Dictionaries ────────────────────────────────────────

const SKILL_DICT: Record<keyof StructuredSkills["categorized"], string[]> = {
  languages: [
    "javascript", "typescript", "python", "java", "c++", "c#", "c", "golang", "go",
    "rust", "ruby", "php", "swift", "kotlin", "scala", "r", "dart", "html", "html5",
    "css", "css3", "sass", "scss", "sql", "bash", "shell"
  ],
  frameworks: [
    "react", "react.js", "next.js", "nextjs", "vue", "vue.js", "angular", "svelte",
    "node.js", "nodejs", "express", "express.js", "fastapi", "django", "flask",
    "spring", "spring boot", "asp.net", "rails", "ruby on rails", "tailwind",
    "tailwind css", "bootstrap", "redux", "graphql", "rest", "restful"
  ],
  databases: [
    "postgresql", "postgres", "mysql", "mongodb", "sqlite", "redis", "cassandra",
    "dynamodb", "elasticsearch", "supabase", "firebase", "oracle", "mariadb", "prisma"
  ],
  cloud: [
    "aws", "amazon web services", "azure", "gcp", "google cloud", "docker",
    "kubernetes", "k8s", "terraform", "ci/cd", "github actions", "gitlab ci",
    "jenkins", "ansible", "linux", "nginx", "serverless", "ec2", "s3", "ecs", "lambda"
  ],
  tools: [
    "git", "github", "gitlab", "jira", "figma", "postman", "vite", "webpack",
    "jest", "cypress", "playwright", "eslint", "prettier", "vscode", "visual studio"
  ],
  other: [
    "agile", "scrum", "microservices", "system design", "data structures",
    "algorithms", "unit testing", "responsive design", "web accessibility",
    "wcag", "seo", "core web vitals", "machine learning", "deep learning"
  ],
};

// ─── Extraction Helpers ───────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4})/;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i;
const GITHUB_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i;
const URL_REGEX = /https?:\/\/[^\s/$.?#].[^\s]*/i;

const SECTION_HEADERS = {
  summary: /^(?:summary|professional summary|about me|profile|executive summary|career objective)\b/i,
  experience: /^(?:experience|work experience|employment history|professional experience|work history)\b/i,
  education: /^(?:education|academic background|academics|qualifications)\b/i,
  skills: /^(?:skills|technical skills|skills & expertise|core competencies|technologies)\b/i,
  projects: /^(?:projects|personal projects|key projects|portfolio projects)\b/i,
  certifications: /^(?:certifications|certificates|licenses & certifications|credentials|awards)\b/i,
};

type SectionKey = keyof typeof SECTION_HEADERS;

/**
 * Splits plain text into sections based on typical resume section headings.
 */
function splitIntoSections(lines: string[]): { header: string[]; sections: Record<SectionKey, string[]> } {
  const sections: Record<SectionKey, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  };
  const header: string[] = [];

  let currentSection: SectionKey | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect if this line matches a known section header
    let matchedSection: SectionKey | null = null;
    for (const [key, regex] of Object.entries(SECTION_HEADERS) as [SectionKey, RegExp][]) {
      const cleanLine = line.replace(/[:\-–—]+$/, "").trim();
      if (regex.test(cleanLine) && cleanLine.length <= 40) {
        matchedSection = key;
        break;
      }
    }

    if (matchedSection) {
      currentSection = matchedSection;
      continue;
    }

    if (currentSection) {
      sections[currentSection].push(line);
    } else {
      header.push(line);
    }
  }

  return { header, sections };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Categorizes a list of skill strings into predefined technical domains.
 */
export function categorizeSkills(rawSkills: string[]): StructuredSkills {
  const normalizedSet = new Set<string>();
  rawSkills.forEach((s) => {
    const clean = s
      .replace(/^(?:languages|frameworks|databases|cloud|tools|other|libraries):?\s*/i, "")
      .trim()
      .replace(/^[-•*,\s]+|[-•*,\s]+$/g, "");
    if (clean.length >= 2 && clean.length <= 40) {
      normalizedSet.add(clean);
    }
  });

  const categorized: StructuredSkills["categorized"] = {
    languages: [],
    frameworks: [],
    databases: [],
    cloud: [],
    tools: [],
    other: [],
  };

  normalizedSet.forEach((skill) => {
    const lower = skill.toLowerCase();
    let assigned = false;

    for (const [category, list] of Object.entries(SKILL_DICT) as [keyof StructuredSkills["categorized"], string[]][]) {
      if (
        list.some(
          (kw) =>
            kw === lower ||
            lower === `${kw}.js` ||
            lower === `${kw}js` ||
            (kw.length >= 4 && (lower === kw || lower.includes(kw)))
        )
      ) {
        categorized[category].push(skill);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      categorized.other.push(skill);
    }
  });

  return {
    raw: Array.from(normalizedSet),
    categorized,
  };
}

/**
 * Tolerantly extracts candidate contact and basics information.
 */
function extractBasics(headerLines: string[], allLines: string[]): StructuredBasics {
  const combinedHeader = headerLines.join(" \n ");
  const allText = allLines.join(" \n ");

  // 1. Email
  const emailMatch = allText.match(EMAIL_REGEX);
  const email = emailMatch ? emailMatch[0].trim() : "";

  // 2. Phone
  const phoneMatch = allText.match(PHONE_REGEX);
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  // 3. LinkedIn
  const linkedInMatch = allText.match(LINKEDIN_REGEX);
  const linkedIn = linkedInMatch ? (linkedInMatch[0].startsWith("http") ? linkedInMatch[0] : `https://${linkedInMatch[0]}`) : "";

  // 4. GitHub
  const githubMatch = allText.match(GITHUB_REGEX);
  const github = githubMatch ? (githubMatch[0].startsWith("http") ? githubMatch[0] : `https://${githubMatch[0]}`) : "";

  // 5. Portfolio / other URL
  let portfolio = "";
  const urls = allText.match(new RegExp(URL_REGEX, "g")) || [];
  for (const u of urls) {
    if (!u.includes("linkedin.com") && !u.includes("github.com")) {
      portfolio = u;
      break;
    }
  }

  // 6. Name: Usually the first non-empty header line that is not an email, phone, or URL
  let name = "";
  for (const line of headerLines) {
    const clean = line.replace(/^[#\s]+/, "").trim();
    if (
      clean.length > 2 &&
      clean.length < 50 &&
      !clean.includes("@") &&
      !clean.includes("http") &&
      !clean.includes("github.com") &&
      !clean.includes("linkedin.com") &&
      !/\d{3,}/.test(clean)
    ) {
      name = clean;
      break;
    }
  }

  // 7. Location: Check header lines for "City, State" patterns
  let location = "";
  const locationRegex = /\b([A-Z][a-zA-Z\s]+),\s*([A-Z]{2}|[A-Z][a-zA-Z]+)\b/;
  for (const line of headerLines.slice(0, 5)) {
    const locMatch = line.match(locationRegex);
    if (locMatch && !locMatch[0].toLowerCase().includes("university") && !locMatch[0].toLowerCase().includes("college")) {
      location = locMatch[0].trim();
      break;
    }
  }

  return {
    name,
    email,
    phone,
    location,
    linkedIn,
    github,
    portfolio,
    summary: "",
  };
}

/**
 * Extracts work experience entries tolerantly.
 */
function extractExperience(lines: string[]): StructuredExperience[] {
  const experiences: StructuredExperience[] = [];
  let current: StructuredExperience | null = null;
  const dateRegex = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4})\s*[-–—to\s]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}|\d{4}|Present|Current)\b/i;

  for (const line of lines) {
    const dateMatch = line.match(dateRegex);

    // If line has date range or separator like "Company | Role | Date"
    if (dateMatch || (/^[A-Z][A-Za-z0-9\s,&.-]+(?:\s*[|•–—]\s*|\s+at\s+)[A-Z][A-Za-z0-9\s,&.-]+/.test(line) && line.length < 90)) {
      if (current) {
        experiences.push(current);
      }

      let role = "";
      let company = "";
      let startDate = "";
      let endDate = "";
      let isCurrent = false;

      if (dateMatch) {
        startDate = dateMatch[1] || "";
        endDate = dateMatch[2] || "";
        isCurrent = /present|current/i.test(endDate);
      }

      // Split remaining text by pipes or dashes
      const lineWithoutDate = dateMatch ? line.replace(dateMatch[0], "").trim() : line;
      const parts = lineWithoutDate.split(/[|•–—]+/).map((p) => p.trim()).filter(Boolean);

      if (parts.length >= 2) {
        role = parts[0];
        company = parts[1];
      } else if (parts.length === 1) {
        const atSplit = parts[0].split(/\s+at\s+/i);
        if (atSplit.length === 2) {
          role = atSplit[0].trim();
          company = atSplit[1].trim();
        } else {
          company = parts[0];
        }
      }

      current = {
        id: `exp-${Date.now()}-${experiences.length}`,
        company,
        role,
        location: "",
        startDate,
        endDate: isCurrent ? "Present" : endDate,
        current: isCurrent,
        bullets: "",
      };
    } else if (current) {
      const cleanBullet = line.replace(/^[•\-\*]\s*/, "").trim();
      if (cleanBullet) {
        current.bullets = current.bullets
          ? `${current.bullets}\n• ${cleanBullet}`
          : `• ${cleanBullet}`;
      }
    }
  }

  if (current) {
    experiences.push(current);
  }

  return experiences;
}

/**
 * Extracts education entries tolerantly.
 */
function extractEducation(lines: string[]): StructuredEducation[] {
  const educations: StructuredEducation[] = [];
  const degreeRegex = /\b(b\.?s\.?|bachelor|m\.?s\.?|master|ph\.?d\.?|associate|b\.?a\.?|m\.?b\.?a\.?)\b/i;
  const yearRegex = /\b(19\d{2}|20\d{2})\b/;

  let current: StructuredEducation | null = null;

  for (const line of lines) {
    const hasDegree = degreeRegex.test(line);
    const hasYear = yearRegex.test(line);

    if (hasDegree || hasYear || line.toLowerCase().includes("university") || line.toLowerCase().includes("college")) {
      if (current) {
        educations.push(current);
      }

      let degree = "";
      let institution = "";
      let graduationYear = "";

      const yMatch = line.match(yearRegex);
      if (yMatch) graduationYear = yMatch[0];

      const parts = line.split(/[|•–—]+/).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (degreeRegex.test(part)) {
          degree = part;
        } else if (part.toLowerCase().includes("university") || part.toLowerCase().includes("college") || part.toLowerCase().includes("institute") || part.toLowerCase().includes("school")) {
          institution = part;
        }
      }

      if (!degree && parts.length > 0 && !institution) {
        institution = parts[0];
      }

      current = {
        id: `edu-${Date.now()}-${educations.length}`,
        institution,
        degree,
        location: "",
        graduationYear,
        gpaOrHonors: "",
      };
    } else if (current && /gpa|honors|magna|summa/i.test(line)) {
      current.gpaOrHonors = line.trim();
    }
  }

  if (current) {
    educations.push(current);
  }

  return educations;
}

/**
 * Main Structured Parser Entry Point.
 * Accepts any plain text resume and extracts canonical structured data safely.
 */
export function parseStructuredResume(rawText: string): CanonicalResume {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const { header, sections } = splitIntoSections(lines);

  // 1. Basics
  const basics = extractBasics(header, lines);
  if (sections.summary.length > 0) {
    basics.summary = sections.summary.join(" ");
  }

  // 2. Skills
  const rawSkillList: string[] = [];
  if (sections.skills.length > 0) {
    sections.skills.forEach((l) => {
      const clean = l.replace(/^(?:skills|technical skills|languages|frameworks|databases|cloud|tools|other):?\s*/i, "");
      clean.split(/[,•|/;\n]+/).forEach((item) => {
        const t = item.trim().replace(/^[-*•\s]+|[-*•\s]+$/g, "");
        if (t.length > 1 && t.length < 40) rawSkillList.push(t);
      });
    });
  } else {
    // Scan full text for high-frequency skills from SKILL_DICT
    const textLower = rawText.toLowerCase();
    Object.values(SKILL_DICT).flat().forEach((kw) => {
      const escaped = escapeRegex(kw);
      const isWord = /^[a-zA-Z0-9_]+$/.test(kw);
      const reg = isWord ? new RegExp(`\\b${escaped}\\b`, "i") : new RegExp(`${escaped}`, "i");
      if (reg.test(textLower)) {
        rawSkillList.push(kw);
      }
    });
  }
  const skills = categorizeSkills(rawSkillList);

  // 3. Work Experience
  const work = extractExperience(sections.experience);

  // 4. Education
  const education = extractEducation(sections.education);

  // 5. Projects
  const projects: StructuredProject[] = [];
  let curProj: StructuredProject | null = null;
  for (const line of sections.projects) {
    if (/^[A-Z0-9][A-Za-z0-9\s_-]+(?:\[[^\]]+\]|\|)/.test(line) || (!curProj && line.length < 60)) {
      if (curProj) projects.push(curProj);
      const parts = line.split(/[|•–—]+/).map((p) => p.trim());
      curProj = {
        id: `proj-${Date.now()}-${projects.length}`,
        title: parts[0] || line,
        techStack: parts[1] || "",
        liveUrl: "",
        repoUrl: "",
        description: "",
      };
    } else if (curProj) {
      curProj.description = curProj.description
        ? `${curProj.description}\n${line}`
        : line;
    }
  }
  if (curProj) projects.push(curProj);

  // 6. Certifications
  const certifications: StructuredCertification[] = [];
  for (const line of sections.certifications) {
    const parts = line.split(/[|•–—]+/).map((p) => p.trim());
    if (parts.length > 0 && parts[0]) {
      certifications.push({
        id: `cert-${Date.now()}-${certifications.length}`,
        name: parts[0],
        issuer: parts[1] || "",
        date: parts[2] || "",
        linkOrId: "",
      });
    }
  }

  return {
    basics,
    skills,
    work,
    education,
    projects,
    certifications,
  };
}
