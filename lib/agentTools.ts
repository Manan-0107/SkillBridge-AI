/**
 * lib/agentTools.ts
 *
 * Controlled, Safe Application Tool Registry for CareerForge AI Agent:
 * - High-security predefined tool catalog (Zero arbitrary JS execution)
 * - Navigation, Resume Audits, Job Searches, Course/Project Recommendations,
 *   GitHub Trends, Job Alerts, and Accessibility Configuration.
 */

import { FeatureId, ResumeTab } from "./intent";
import { AccessibilityPreferences } from "./store";

export type AgentToolName =
  | "navigateTo"
  | "openResume"
  | "openSkillAnalysis"
  | "searchJobs"
  | "searchCourses"
  | "searchProjects"
  | "searchGithub"
  | "openJob"
  | "configureJobAlerts"
  | "updateAccessibilityPreferences"
  | "conversationalResumeBuilder"
  | "readPage";

export interface AgentToolCall {
  tool: AgentToolName;
  parameters: Record<string, any>;
}

export interface AgentExecutionResult {
  success: boolean;
  message: string;
  data?: any;
  actionTaken?: string;
  redirect?: {
    feature: FeatureId;
    resumeTab?: ResumeTab;
  };
}

export const AGENT_TOOLS_DEFINITIONS = [
  {
    name: "navigateTo",
    description: "Navigate safely to a specific application page/suite.",
    parameters: {
      page: { type: "string", enum: ["assistant", "resume", "roadmap", "courses", "practice", "local"], required: true },
      tab: { type: "string", enum: ["analyzer", "personalizer", "builder"], required: false },
    },
  },
  {
    name: "openResume",
    description: "Open the Resume Suite (Analyzer, Personalizer, or Builder).",
    parameters: {
      tab: { type: "string", enum: ["analyzer", "personalizer", "builder"], required: false },
    },
  },
  {
    name: "openSkillAnalysis",
    description: "Navigate to the Resume Analyzer and Skill Gap audit dashboard.",
    parameters: {},
  },
  {
    name: "searchJobs",
    description: "Query real-time verified jobs with role, location, remote, and skill filters.",
    parameters: {
      role: { type: "string", required: false },
      location: { type: "string", required: false },
      remote: { type: "boolean", required: false },
      skills: { type: "array", items: { type: "string" }, required: false },
    },
  },
  {
    name: "searchCourses",
    description: "Find curated courses based on target role, missing skill, and difficulty level.",
    parameters: {
      topic: { type: "string", required: true },
      level: { type: "string", enum: ["Beginner", "Intermediate", "Advanced"], required: false },
      freeOnly: { type: "boolean", required: false },
    },
  },
  {
    name: "searchProjects",
    description: "Recommend portfolio projects categorized by difficulty (Beginner, Intermediate, Advanced) with rationales.",
    parameters: {
      skill: { type: "string", required: true },
      difficulty: { type: "string", enum: ["Beginner", "Intermediate", "Advanced", "All"], required: false },
    },
  },
  {
    name: "searchGithub",
    description: "Search trending open-source GitHub repositories for a given topic or learning track.",
    parameters: {
      query: { type: "string", required: true },
      topic: { type: "string", required: false },
    },
  },
  {
    name: "configureJobAlerts",
    description: "Configure and test real-time email job alert preferences.",
    parameters: {
      email: { type: "string", required: true },
      role: { type: "string", required: false },
      location: { type: "string", required: false },
      remote: { type: "boolean", required: false },
      frequency: { type: "string", enum: ["Immediately", "Daily", "Weekly"], required: false },
    },
  },
  {
    name: "updateAccessibilityPreferences",
    description: "Update user interaction preferences (speech output, high contrast, large text, simplified language).",
    parameters: {
      interactionMode: { type: "string", enum: ["voice", "text", "hybrid"], required: false },
      speechOutput: { type: "boolean", required: false },
      visualResponses: { type: "boolean", required: false },
      simplifiedLanguage: { type: "boolean", required: false },
      highContrast: { type: "boolean", required: false },
      largeText: { type: "boolean", required: false },
      reducedMotion: { type: "boolean", required: false },
    },
  },
  {
    name: "conversationalResumeBuilder",
    description: "Step-by-step conversational resume creator when user does not have a resume.",
    parameters: {
      step: { type: "number", required: true },
      field: { type: "string", required: true },
      value: { type: "string", required: true },
      action: { type: "string", enum: ["next", "back", "skip", "repeat", "continue"], required: false },
    },
  },
  {
    name: "readPage",
    description: "Vocalize and summarize the current page contents for screen reader / voice users.",
    parameters: {
      section: { type: "string", required: false },
    },
  },
];
