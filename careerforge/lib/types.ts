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
  authProvider: "email" | "google";
  targetRole: RoleId | null;
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
