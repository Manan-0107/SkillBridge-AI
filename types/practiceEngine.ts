/**
 * Strict TypeScript models for CDN-First, Zero-Runtime-DB Roadmap & Daily Practice Engine.
 * Runtime flow: CDN → Static JSON → React → localStorage
 */

export type TrackId = "frontend" | "backend" | "mobile" | "fullstack";

export type QuestionDifficulty = "beginner" | "intermediate" | "advanced";

export type QuestionType = "multiple-choice" | "code-analysis" | "architecture";

export interface PracticeQuestion {
  id: string;
  track: TrackId;
  dayNumber: number;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  title: string;
  question: string;
  codeSnippet?: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string; // Markdown supported
  tags: string[];
  hints?: string[];
  relatedRoadmapNodeId?: string;
}

export interface DailyPracticePayload {
  version: "1.0.0";
  date: string; // YYYY-MM-DD
  track: TrackId;
  trackTitle: string;
  generatedAt: string; // ISO UTC
  checksum: string;
  totalQuestions: 10;
  questions: PracticeQuestion[];
}

export interface UserAnswerRecord {
  questionId: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
  answeredAt: string;
}

export interface DailyPracticeState {
  date: string;
  track: TrackId;
  answers: Record<string, UserAnswerRecord>;
  completed: boolean;
  score: number; // 0 - 10
  timeSpentSeconds: number;
}

export interface PracticeStreakStats {
  currentStreak: number;
  bestStreak: number;
  lastActiveDate: string | null;
  totalCompletedDays: number;
  totalQuestionsAnswered: number;
  totalCorrect: number;
}

// ─── STATIC ROADMAP TREE SCHEMA ──────────────────────────────────────────────

export type NodeStatus = "completed" | "in-progress" | "planned";

export interface ConceptChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  summary?: string;
}

export interface ResourceItem {
  title: string;
  url: string;
  type: "docs" | "video" | "article" | "github";
  isFree?: boolean;
}

export interface StaticRoadmapNode {
  id: string;
  track: TrackId;
  title: string;
  slug: string;
  description: string;
  status: NodeStatus;
  level: "fundamental" | "intermediate" | "advanced";
  tierNumber: number;
  position: {
    column: "left" | "center" | "right";
    order: number;
  };
  prerequisites: string[]; // Node IDs
  childrenIds: string[];   // Direct child Node IDs
  keyConcepts: string[];
  checklist: ConceptChecklistItem[];
  resources: ResourceItem[];
  badge?: string;
  estimatedHours: number;
}

export interface StaticRoadmapPayload {
  version: "1.0.0";
  roadmapId: TrackId;
  title: string;
  tagline: string;
  description: string;
  updatedAt: string;
  totalEstimatedHours: number;
  tiers: {
    tierNumber: number;
    title: string;
    subtitle?: string;
  }[];
  nodes: StaticRoadmapNode[];
}

export interface UserRoadmapProgress {
  track: TrackId;
  nodeStatuses: Record<string, NodeStatus>;
  checklistStates: Record<string, Record<string, boolean>>; // nodeId -> { itemId -> boolean }
  selectedNodeId: string | null;
  lastUpdated: string;
}
