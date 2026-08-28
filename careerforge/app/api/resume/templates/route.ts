import { NextResponse } from "next/server";

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
  },
  {
    id: "executive",
    name: "Executive Minimalist ATS",
    githubSource: "salman-w/executive-resume-template",
    atsScore: 98,
    description: "Refined leadership format emphasizing high-level career summary, business impact metrics, and team leadership.",
    bestFor: "Engineering Leads, Product Managers, Directors & Executives",
    recommendedFont: "Inter / Georgia",
    structure: "single_column",
    features: ["Executive Bio Spotlight", "Quantified Outcomes Focus", "Clean Divider Accents", "Leadership Highlights"],
  },
  {
    id: "latex",
    name: "LaTeX Modern CV ATS",
    githubSource: "posquit0/Awesome-CV",
    atsScore: 96,
    description: "Academic and tech-heavy LaTeX aesthetic with precise alignment, monospace skill pills, and crisp metadata formatting.",
    bestFor: "Data Scientists, ML Engineers, Researchers & Backend Devs",
    recommendedFont: "JetBrains Mono / Inter",
    structure: "single_column",
    features: ["LaTeX Style Geometry", "Monospace Tech Highlights", "Clean Right-Aligned Dates", "Clear Category Separation"],
  },
];

export async function GET() {
  return NextResponse.json({
    status: "success",
    source: "Open Source ATS Layout Engine (GitHub Inspired)",
    count: atsTemplates.length,
    templates: atsTemplates,
    standardsCompliant: ["Workday", "Greenhouse", "Lever", "Taleo", "iCIMS", "JSONResume v1.0.0"],
  });
}
