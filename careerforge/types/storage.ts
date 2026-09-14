export interface UserProgress {
  version: number;
  completedNodeIds: string[];
  inProgressNodeIds: string[];
  lastSelectedNodeId?: string;
  updatedAt: string;
}

export interface ChecklistState {
  version: number;
  // Map of nodeId -> array of completed conceptIds
  checkedConcepts: Record<string, string[]>;
  updatedAt: string;
}

export interface UserAnswerRecord {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  answeredAt: string;
}

export interface QuizAnswerState {
  version: number;
  date: string;
  track: string;
  answers: Record<string, UserAnswerRecord>;
  isCompleted: boolean;
  score: number;
  completedAt?: string;
}

export interface UIPreferences {
  version: number;
  selectedTrack?: string;
  filterStatus?: ("completed" | "in-progress" | "planned")[];
  searchQuery?: string;
  zoomLevel?: number;
}
