export type RoleId =
  | "frontend"
  | "backend"
  | "data"
  | "product"
  | "design"
  | "devops";

export interface RoleOption {
  id: RoleId;
  label: string;
  blurb: string;
}

export interface User {
  name: string;
  email: string;
  phone?: string;
  picture?: string;
  authProvider: "email" | "google" | "github" | "phone";
  targetRole: RoleId | null;
  /** Supabase DB row id — null when DB is not configured */
  dbId?: string | null;
}

export interface RoadmapStep {
  title: string;
  detail: string;
  skills: string[];
}

export interface Course {
  title: string;
  provider: "Udemy" | "Coursera";
  level: "Beginner" | "Intermediate" | "Advanced";
  rating: number;
  url: string;
}

export interface ResumeAnalysis {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
}

export interface LocalOpportunity {
  title: string;
  org: string;
  type: "Internship" | "Job" | "Meetup";
  distanceKm: number;
  address: string;
}

// ─── Enhanced multi-engine analysis types ─────────────────────────────────────

export interface SkillGapItem {
  skill: string;
  priority: "high" | "medium" | "low";
  why: string;
  resources: { label: string; url: string }[];
}

export interface EngineResult {
  name: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  available: boolean;
}

export interface EnhancedAnalysis {
  overallScore: number;
  engines: {
    heuristic: EngineResult;
    github: EngineResult;
    ai: EngineResult;
  };
  matchedSkills: string[];
  missingSkills: string[];
  skillGapRoadmap: SkillGapItem[];
  suggestions: string[];
  savedToDb: boolean;
  uploadId: string | null;
}
