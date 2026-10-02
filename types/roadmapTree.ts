export type NodeStatus = "completed" | "in-progress" | "planned" | "locked";

export type TechCategory =
  | "frontend"
  | "backend"
  | "devops"
  | "data-ai"
  | "system-design"
  | "fullstack";

export type NodeImportance = "essential" | "recommended" | "optional";

export type NodeLevel = "fundamental" | "intermediate" | "advanced";

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  notes?: string;
  conceptUrl?: string;
  summary?: string;
}

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
  type: "documentation" | "video" | "article" | "course" | "book" | "github";
  provider?: string;
  duration?: string;
  badge?: string;
  isFree?: boolean;
}

export interface RoadmapProject {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  skills: string[];
  githubUrl?: string;
}

export interface RoadmapConnection {
  from: string; // Node ID
  to: string;   // Node ID
  type: "required" | "optional" | "related";
  label?: string;
}

export interface RoadmapNode {
  id: string;
  title: string;
  slug: string;
  category: TechCategory;
  level: NodeLevel;
  importance: NodeImportance;
  status: NodeStatus;
  estimatedHours: number;
  description: string;
  summary: string;
  whyItMatters?: string;
  keyConcepts: string[];
  skills?: string[];
  checklist: ChecklistItem[];
  resources: ResourceLink[];
  projects?: RoadmapProject[];
  relatedTopics?: string[];
  prerequisites?: string[]; // IDs of parent/predecessor nodes
  childrenIds?: string[];   // IDs of successor nodes
  connectionType?: "required" | "optional" | "related";
  branchType?: "trunk" | "left-branch" | "right-branch" | "fork-choice" | "milestone";
  branches?: RoadmapNode[]; // Nested sub-branching nodes
  badge?: string;
  officialDocsUrl?: string;
}

export interface RoadmapTier {
  id: string;
  stageNumber: number;
  title: string;
  subtitle?: string;
  category: TechCategory;
  trunkNode: RoadmapNode;
  branches?: RoadmapNode[];
  milestoneStatus?: "completed" | "current" | "upcoming";
}

export interface RoadmapCacheMetadata {
  cached: boolean;
  cacheEngine: string;
  key: string;
  ttlSeconds: number;
  generatedMs: number;
  backendWorker: string;
  timestamp: string;
}

export interface RoadmapTreeData {
  roadmapId: string;
  title: string;
  category: TechCategory;
  description: string;
  version: string;
  totalEstimatedHours: number;
  tiers: RoadmapTier[];
  allNodes: RoadmapNode[];
  connections?: RoadmapConnection[];
  categories: {
    id: TechCategory;
    label: string;
    description: string;
    icon: string;
    count: number;
    accentColor: string;
  }[];
  cacheMetadata: RoadmapCacheMetadata;
}

export interface RoadmapApiResponse {
  success: boolean;
  data: RoadmapTreeData;
  error?: string;
}

