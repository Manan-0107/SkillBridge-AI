export interface Concept {
  id: string;
  label: string;
}

export interface Resource {
  title: string;
  url: string;
  type: "article" | "video" | "docs" | "course";
}

export interface RoadmapNode {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "planned";
  track: "frontend" | "backend" | "mobile" | "fullstack";
  depth: number;
  parentIds: string[];
  children: string[];
  concepts: Concept[];
  prerequisites: string[];
  resources: Resource[];
  position?: {
    branch: number;
    order: number;
  };
}

export interface RoadmapDocument {
  roadmapId: string;
  version: number;
  generatedAt: string;
  nodes: RoadmapNode[];
}
