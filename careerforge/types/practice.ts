import { RoadmapNode } from "./roadmap";

export interface PracticeQuestion {
  id: string;
  track: RoadmapNode["track"];
  question: string;
  options?: string[];
  answerType: "mcq" | "short";
  answer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export interface DailyPracticeDocument {
  date: string;
  track: PracticeQuestion["track"];
  questions: PracticeQuestion[]; // exactly 10
}
