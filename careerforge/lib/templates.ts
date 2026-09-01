export type AtsTemplate = {
  id: "harvard" | "silicon" | "two_column" | "executive" | "latex";
  name: string;
  githubSource: string;
  atsScore: number;
  description: string;
  bestFor: string;
  recommendedFont: string;
  structure: "single_column" | "two_column";
  features: string[];
  supportedColors: string[]; // List of color IDs supported by this GitHub framework standard
  colorPolicyNotes: string;
};

export const atsTemplates: AtsTemplate[] = [
  {
    id: "harvard",
    name: "Harvard Classic ATS",
    githubSource: "awesome-cv / harvard-resume-latex",
    atsScore: 99,
    description: "The gold standard Ivy League single-column template with horizontal dividing rules, maximum parser legibility.",
    bestFor: "Software Engineers, Finance, Management & General Industry",
    recommendedFont: "Merriweather / Times / Serif",
    structure: "single_column",
    features: ["100% Parser Compliant", "Standardized Section Headers", "Metric-Driven Bullet Structure", "Zero Tables/Icons"],
    supportedColors: ["black"],
    colorPolicyNotes: "Harvard ATS standard from GitHub strictly enforces pure Monochrome Black & White for maximum ATS parse rate.",
  },
  {
    id: "silicon",
    name: "Silicon Tech / Reactive ATS",
    githubSource: "AmruthPillai/Reactive-Resume",
    atsScore: 97,
    description: "Modern tech-industry layout inspired by top GitHub software developer portfolios with technology tags and GitHub links.",
    bestFor: "Full-Stack, Frontend, Backend & Mobile Developers",
    recommendedFont: "Inter / Sans-Serif",
    structure: "single_column",
    features: ["Accent Border Headings", "Tech Stack Badges", "Repository & Demo Links", "Clean Hierarchy"],
    supportedColors: ["black", "navy", "emerald", "indigo", "crimson"],
    colorPolicyNotes: "Reactive-Resume standard fully supports all vibrant color accent themes.",
  },
  {
    id: "two_column",
    name: "Two-Column Compact ATS",
    githubSource: "jsonresume/jsonresume-theme-kendall",
    atsScore: 94,
    description: "Space-efficient side rail for skills, education & certs, preserving standard linear reading order for ATS parsers.",
    bestFor: "1-Page Resumes, Junior to Mid-level Engineers, Career Changers",
    recommendedFont: "Outfit / Inter",
    structure: "two_column",
    features: ["1-Page Fit Optimization", "Skill Tag Cloud", "Compact Date Labels", "Side Rail Contact Info"],
    supportedColors: ["black", "navy", "emerald", "indigo", "crimson"],
    colorPolicyNotes: "JSONResume Kendall theme supports multi-color side rail and border accents.",
  },
  {
    id: "executive",
    name: "Executive Minimalist ATS",
    githubSource: "salman-w/executive-resume-template",
    atsScore: 98,
    description: "Subtle serif typography with centered title branding, optimized for leadership and senior staff roles.",
    bestFor: "Senior Engineers, Tech Leads, Engineering Managers & Executives",
    recommendedFont: "Newsreader / Georgia",
    structure: "single_column",
    features: ["Centered Header Identity", "Executive Summary Block", "Subtle Border Accents", "Dense Information Architecture"],
    supportedColors: ["black", "navy", "emerald", "indigo", "crimson"],
    colorPolicyNotes: "Executive template standard supports classic dark accent rules and titles.",
  },
  {
    id: "latex",
    name: "Jake's LaTeX Classic",
    githubSource: "jakegut/resume",
    atsScore: 100,
    description: "The universally acclaimed LaTeX resume template from GitHub / Overleaf used by thousands of FAANG engineers.",
    bestFor: "FAANG / High-Frequency Trading / Deep Tech & Research Roles",
    recommendedFont: "Computer Modern / Serif",
    structure: "single_column",
    features: ["100/100 ATS Score", "Dense LaTeX Whitespace Ratio", "Pipe-Separated Header Details", "Standard Overleaf Structure"],
    supportedColors: ["black"],
    colorPolicyNotes: "Jake's LaTeX repository standard enforces pure crisp black text formatting.",
  },
];
