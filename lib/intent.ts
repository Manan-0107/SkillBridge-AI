import { RoleId } from "./types";

export type FeatureId = "resume" | "roadmap" | "courses" | "practice" | "local";
export type ResumeTab = "analyzer" | "personalizer" | "builder";

export type ParsedIntent = {
  feature: FeatureId | null;
  featureTitle?: string;
  resumeTab?: ResumeTab;
  role?: RoleId;
  reply: string;
  badge?: string;
};

const roleHints: { role: RoleId; keys: string[] }[] = [
  { role: "frontend", keys: ["frontend", "front-end", "front end", "react", "next.js", "javascript", "typescript", "ui engineer", "css", "html", "web dev", "web development"] },
  { role: "backend", keys: ["backend", "back-end", "back end", "node", "nodejs", "python", "django", "java", "api", "sql", "database", "api engineer", "server", "golang", "rust"] },
  { role: "data", keys: ["data analyst", "data scientist", "machine learning", "ml engineer", "ai engineer", "data engineer", "artificial intelligence", "pandas", "pytorch", "deep learning"] },
  { role: "product", keys: ["product manager", " product ", "pm role", "product management", "scrum", "agile", "roadmapping"] },
  { role: "design", keys: ["product designer", "ux", "ui design", "figma", "user experience", "ui/ux", "wireframing", "prototyping"] },
  { role: "devops", keys: ["devops", "sre", "platform engineer", "kubernetes", "docker", "ci/cd", "cloud", "aws", "terraform", "infrastructure"] },
];

function includesAny(text: string, keys: string[]) {
  return keys.some((k) => text.includes(k));
}

export function parseIntent(raw: string): ParsedIntent {
  const text = raw.toLowerCase().trim();
  const role = roleHints.find((r) => includesAny(text, r.keys))?.role;

  // 1. Resume Builder
  if (
    includesAny(text, [
      "build resume",
      "create resume",
      "write resume",
      "make a resume",
      "draft resume",
      "resume builder",
      "from scratch",
      "new resume",
      "generate resume",
    ])
  ) {
    return {
      feature: "resume",
      featureTitle: "Resume Builder",
      resumeTab: "builder",
      role,
      badge: "Drafting Tool",
      reply: "Opening the Resume Builder so you can draft a clean, professional resume step-by-step.",
    };
  }

  // 2. Resume Personalizer / Tailoring
  if (
    includesAny(text, [
      "tailor",
      "personalize",
      "personaliser",
      "adapt my resume",
      "target role resume",
      "customize resume",
      "match job description",
      "fit for role",
    ])
  ) {
    return {
      feature: "resume",
      featureTitle: "Resume Personalizer",
      resumeTab: "personalizer",
      role,
      badge: "Role Alignment",
      reply: "Redirecting you to the Resume Personalizer to adapt your experience to your target role.",
    };
  }

  // 3. Resume Analyzer / ATS
  if (
    includesAny(text, [
      "resume",
      "cv",
      "analyze",
      "analyse",
      "ats",
      "score my",
      "resume review",
      "check resume",
      "audit resume",
      "resume feedback",
      "skill analysis",
      "skill gap",
      "skills analysis",
      "skills gap",
      "skill audit",
    ])
  ) {
    return {
      feature: "resume",
      featureTitle: "Resume Analyzer",
      resumeTab: "analyzer",
      role,
      badge: "ATS Scanner",
      reply: "Taking you to the Resume Analyzer where you can audit your resume against industry benchmarks.",
    };
  }

  // 4. Career Roadmap / Skill Tree / Career Path
  if (
    includesAny(text, [
      "roadmap",
      "career path",
      "career plan",
      "what should i learn",
      "skill path",
      "milestone",
      "progression",
      "guide",
      "learning path",
      "how to become",
      "step by step",
      "transition to",
      "career track",
    ])
  ) {
    return {
      feature: "roadmap",
      featureTitle: "Career Roadmap",
      role,
      badge: "Growth Milestones",
      reply: `Opening your curated ${role ? role + " " : ""}Career Roadmap with phased skills and milestone checklists.`,
    };
  }

  // 5. Courses & Certifications
  if (
    includesAny(text, [
      "course",
      "courses",
      "udemy",
      "coursera",
      "learn",
      "class",
      "classes",
      "certification",
      "certifications",
      "tutorial",
      "study",
      "training",
      "upskill",
      "books",
      "resources",
    ])
  ) {
    return {
      feature: "courses",
      featureTitle: "Curated Courses",
      role,
      badge: "Skill Catalog",
      reply: `Redirecting you to top hand-picked courses and certifications for ${role ? role : "your career track"}.`,
    };
  }

  // 6. Practice Hub & Interview Prep
  if (
    includesAny(text, [
      "practice",
      "interview",
      "interviews",
      "mock",
      "leetcode",
      "codedex",
      "codepip",
      "coding challenge",
      "dsa",
      "algorithm",
      "behavioral",
      "system design",
      "questions",
      "drill",
      "prep",
      "quiz",
    ])
  ) {
    return {
      feature: "practice",
      featureTitle: "Practice & Interview Hub",
      role,
      badge: "Interactive Drills",
      reply: "Opening the Practice Hub featuring interactive coding challenges, gamified drills, and interview prep tools.",
    };
  }

  // 7. Local Opportunities / Jobs / Internships
  if (
    includesAny(text, [
      "job",
      "jobs",
      "internship",
      "internships",
      "hiring",
      "vacancy",
      "meetup",
      "meetups",
      "nearby",
      "local",
      "around me",
      "opportunities",
      "companies",
      "opening",
      "openings",
      "work near",
      "remote job",
    ])
  ) {
    return {
      feature: "local",
      featureTitle: "Local Opportunities",
      role,
      badge: "Job Matcher",
      reply: "Navigating to Local Opportunities to explore nearby tech companies, active hiring hubs, and meetups.",
    };
  }

  // 8. Default AI response if no immediate feature redirect is detected
  return {
    feature: null,
    role,
    badge: "AI Assistant",
    reply:
      "I’m here to guide your career growth. You can ask me to view your career roadmap, find curated courses, practice for interviews, discover local jobs and internships, or work on your resume. What would you like to explore?",
  };
}
