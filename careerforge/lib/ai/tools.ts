/**
 * lib/ai/tools.ts
 *
 * Controlled Application Tools registry using Vercel AI SDK `tool()` and Zod schemas.
 * Enforces strict parameter validation, authorization boundaries, and mandatory
 * confirmation loops for sensitive account/data operations.
 */

import { tool } from "ai";
import { z } from "zod";
import crypto from "crypto";
import { FeatureId, ResumeTab } from "../intent";

// ─── Confirmation Token Registry for Sensitive Actions ─────────────────────────
interface PendingConfirmation {
  token: string;
  toolName: string;
  parameters: Record<string, any>;
  expiresAt: number;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

export function createConfirmationToken(toolName: string, parameters: Record<string, any>): string {
  const token = `conf_${crypto.randomBytes(8).toString("hex")}`;
  pendingConfirmations.set(token, {
    token,
    toolName,
    parameters,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
  });
  return token;
}

export function verifyAndConsumeConfirmationToken(token: string, toolName: string): boolean {
  const entry = pendingConfirmations.get(token);
  if (!entry) return false;
  if (entry.toolName !== toolName || Date.now() > entry.expiresAt) {
    pendingConfirmations.delete(token);
    return false;
  }
  pendingConfirmations.delete(token);
  return true;
}

export const aiTools = {
  // ─── SAFE ACTIONS (Navigation & Content Inspection) ─────────────────────────
  navigateTo: tool({
    description: "Navigate safely to a specific application page/suite.",
    inputSchema: z.object({
      page: z
        .enum(["assistant", "resume", "roadmap", "courses", "practice", "local", "progress"])
        .describe("The platform page to navigate to"),
      tab: z
        .enum(["analyzer", "personalizer", "builder"])
        .optional()
        .describe("Optional specific tab for the page"),
    }),
    execute: async ({ page, tab }) => {
      return {
        success: true,
        page: page as FeatureId,
        tab: tab as ResumeTab | undefined,
        actionTaken: `Navigating to ${page}${tab ? ` (${tab})` : ""}`,
      };
    },
  }),

  openRoadmap: tool({
    description: "Open the visual Career Roadmap and milestone skill constellation.",
    inputSchema: z.object({
      role: z.string().optional().describe("Optional target role to visualize"),
    }),
    execute: async ({ role }) => {
      return {
        success: true,
        page: "roadmap" as FeatureId,
        role,
        actionTaken: "Opening career roadmap",
      };
    },
  }),

  showSkillGaps: tool({
    description: "Open the Skill Gap Analysis and audit current strengths vs target role.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        success: true,
        page: "resume" as FeatureId,
        tab: "analyzer" as ResumeTab,
        actionTaken: "Displaying skill gaps audit",
      };
    },
  }),

  openResume: tool({
    description: "Open the Resume Suite (Analyzer, Personalizer, or Builder).",
    inputSchema: z.object({
      tab: z
        .enum(["analyzer", "personalizer", "builder"])
        .optional()
        .describe("Target resume tab"),
    }),
    execute: async ({ tab }) => {
      return {
        success: true,
        page: "resume" as FeatureId,
        tab: tab as ResumeTab | undefined,
        actionTaken: `Opening resume suite${tab ? ` (${tab})` : ""}`,
      };
    },
  }),

  buildResume: tool({
    description: "Open the Resume Builder studio for conversational or structured editing.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        success: true,
        page: "resume" as FeatureId,
        tab: "builder" as ResumeTab,
        actionTaken: "Opening resume builder",
      };
    },
  }),

  openSkillAnalysis: tool({
    description: "Navigate to the Resume Analyzer and Skill Gap audit dashboard.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        success: true,
        page: "resume" as FeatureId,
        tab: "analyzer" as ResumeTab,
        actionTaken: "Opening skill gap analyzer",
      };
    },
  }),

  searchJobs: tool({
    description: "Query real-time verified jobs with role, location, remote, and skill filters.",
    inputSchema: z.object({
      role: z.string().optional().describe("Job title or keyword"),
      location: z.string().optional().describe("City, region, or country"),
      remote: z.boolean().optional().describe("Filter for remote opportunities"),
      skills: z.array(z.string()).optional().describe("Required skills"),
    }),
    execute: async ({ role, location, remote, skills }) => {
      return {
        success: true,
        page: "local" as FeatureId,
        role,
        location,
        remote,
        skills,
        actionTaken: `Searching jobs for ${role || "target profile"}${location ? ` in ${location}` : ""}`,
      };
    },
  }),

  findJobs: tool({
    description: "Navigate to the Jobs radar and explore verified opportunities.",
    inputSchema: z.object({
      role: z.string().optional().describe("Optional filter for role"),
      location: z.string().optional().describe("Optional location query"),
    }),
    execute: async ({ role, location }) => {
      return {
        success: true,
        page: "local" as FeatureId,
        role,
        location,
        actionTaken: `Opening jobs radar for ${role || "career goal"}`,
      };
    },
  }),

  startPractice: tool({
    description: "Open the Technical Practice lab for coding drills, system design, and mock interviews.",
    inputSchema: z.object({
      track: z.string().optional().describe("Technical track (frontend, backend, fullstack, devops, etc.)"),
    }),
    execute: async ({ track }) => {
      return {
        success: true,
        page: "practice" as FeatureId,
        track,
        actionTaken: `Starting practice training lab${track ? ` for ${track}` : ""}`,
      };
    },
  }),

  openLearning: tool({
    description: "Open the Curated Learning and Knowledge Library catalog.",
    inputSchema: z.object({
      topic: z.string().optional().describe("Topic or technology to explore"),
    }),
    execute: async ({ topic }) => {
      return {
        success: true,
        page: "courses" as FeatureId,
        topic,
        actionTaken: `Opening learning library${topic ? ` for ${topic}` : ""}`,
      };
    },
  }),

  searchCourses: tool({
    description: "Find curated courses based on target role, missing skill, and difficulty level.",
    inputSchema: z.object({
      topic: z.string().describe("Topic, technology, or skill to learn"),
      level: z.enum(["Beginner", "Intermediate", "Advanced"]).optional().describe("Difficulty level"),
      freeOnly: z.boolean().optional().describe("Only show free courses"),
    }),
    execute: async ({ topic, level, freeOnly }) => {
      return {
        success: true,
        page: "courses" as FeatureId,
        topic,
        level,
        freeOnly,
        actionTaken: `Searching courses for ${topic}`,
      };
    },
  }),

  showProgress: tool({
    description: "Open the Career Telemetry & Progress dashboard.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        success: true,
        page: "progress" as FeatureId,
        actionTaken: "Opening career telemetry & progress",
      };
    },
  }),

  goHome: tool({
    description: "Navigate back to the main workspace home.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        success: true,
        page: "assistant" as FeatureId,
        actionTaken: "Navigating to home assistant workspace",
      };
    },
  }),

  goBack: tool({
    description: "Navigate to the previously active workspace view.",
    inputSchema: z.object({}),
    execute: async () => {
      return {
        success: true,
        navigateBack: true,
        actionTaken: "Navigating back to previous view",
      };
    },
  }),

  searchProjects: tool({
    description: "Recommend portfolio projects categorized by difficulty with rationales.",
    inputSchema: z.object({
      skill: z.string().describe("Target skill or framework"),
      difficulty: z.enum(["Beginner", "Intermediate", "Advanced", "All"]).optional().describe("Project difficulty level"),
    }),
    execute: async ({ skill, difficulty }) => {
      return {
        success: true,
        skill,
        difficulty,
        actionTaken: `Recommending portfolio projects for ${skill}`,
      };
    },
  }),

  searchGithub: tool({
    description: "Search trending open-source GitHub repositories for a given topic or learning track.",
    inputSchema: z.object({
      query: z.string().describe("Search keywords for repositories"),
      topic: z.string().optional().describe("Topic filter"),
    }),
    execute: async ({ query, topic }) => {
      return {
        success: true,
        query,
        topic,
        actionTaken: `Searching GitHub repositories for ${query}`,
      };
    },
  }),

  updateAccessibilityPreferences: tool({
    description: "Update user interaction preferences (speech output, high contrast, large text, simplified language).",
    inputSchema: z.object({
      interactionMode: z.enum(["voice", "text", "hybrid"]).optional().describe("Preferred interaction mode"),
      speechOutput: z.boolean().optional().describe("Enable speech synthesis"),
      visualResponses: z.boolean().optional().describe("Enable visual subtitles / text"),
      simplifiedLanguage: z.boolean().optional().describe("Use concise, plain language"),
      highContrast: z.boolean().optional().describe("High-contrast visual styling"),
      largeText: z.boolean().optional().describe("Larger typography scale"),
      reducedMotion: z.boolean().optional().describe("Disable UI animations"),
    }),
    execute: async (prefs) => {
      return {
        success: true,
        prefs,
        actionTaken: "Updated user accessibility preferences",
      };
    },
  }),

  conversationalResumeBuilder: tool({
    description: "Step-by-step conversational resume creator when user does not have an uploaded resume.",
    inputSchema: z.object({
      step: z.number().describe("Current step number"),
      field: z.string().optional().describe("Resume field being populated"),
      value: z.string().optional().describe("Value extracted from conversation"),
      action: z.enum(["next", "back", "skip", "repeat", "continue"]).optional().describe("Navigation action"),
    }),
    execute: async ({ step, field, value, action }) => {
      return {
        success: true,
        step,
        field,
        value,
        action,
        actionTaken: field ? `Recorded ${field} at step ${step}` : `Processed resume step ${step}${action ? ` (${action})` : ""}`,
      };
    },
  }),

  readPage: tool({
    description: "Vocalize and summarize current page contents for screen reader / voice users.",
    inputSchema: z.object({
      section: z.string().optional().describe("Specific page section to read"),
    }),
    execute: async ({ section }) => {
      return {
        success: true,
        section,
        actionTaken: `Reading ${section || "current page"}`,
      };
    },
  }),

  // ─── SENSITIVE ACTIONS (Mandatory Confirmation Protocol Required) ───────────
  modifyProfile: tool({
    description: "Request updating candidate profile name, email, or core role. SENSITIVE: Requires explicit user confirmation.",
    inputSchema: z.object({
      name: z.string().optional().describe("New display name"),
      email: z.string().email().optional().describe("New contact email"),
      targetRole: z.string().optional().describe("New target role"),
      confirmed: z.boolean().default(false).describe("Whether user has explicitly confirmed this change"),
      confirmationToken: z.string().optional().describe("Signed confirmation token if previously confirmed"),
    }),
    execute: async ({ name, email, targetRole, confirmed, confirmationToken }) => {
      if (!confirmed || !confirmationToken || !verifyAndConsumeConfirmationToken(confirmationToken, "modifyProfile")) {
        const token = createConfirmationToken("modifyProfile", { name, email, targetRole });
        return {
          success: false,
          requiresConfirmation: true,
          confirmationType: "PROFILE_MODIFICATION",
          description: `Are you sure you want to update your profile? ${name ? `Name: "${name}". ` : ""}${email ? `Email: "${email}". ` : ""}${targetRole ? `Role: "${targetRole}".` : ""}`,
          confirmationToken: token,
          actionTaken: "Awaiting explicit user confirmation before applying profile changes.",
        };
      }

      return {
        success: true,
        applied: true,
        name,
        email,
        targetRole,
        actionTaken: "Profile successfully updated after explicit confirmation.",
      };
    },
  }),

  configureJobAlerts: tool({
    description: "Configure real-time email job alert preferences. Requires explicit confirmation before committing notification cadence.",
    inputSchema: z.object({
      email: z.string().email().describe("User email for alerts"),
      role: z.string().optional().describe("Target job role"),
      location: z.string().optional().describe("Target location"),
      remote: z.boolean().optional().describe("Remote-only preference"),
      frequency: z.enum(["Immediately", "Daily", "Weekly"]).optional().describe("Alert notification frequency"),
      confirmed: z.boolean().default(false).describe("Whether user has confirmed setting this alert"),
      confirmationToken: z.string().optional().describe("Verification token"),
    }),
    execute: async ({ email, role, location, remote, frequency, confirmed, confirmationToken }) => {
      if (!confirmed || !confirmationToken || !verifyAndConsumeConfirmationToken(confirmationToken, "configureJobAlerts")) {
        const token = createConfirmationToken("configureJobAlerts", { email, role, location, remote, frequency });
        return {
          success: false,
          requiresConfirmation: true,
          confirmationType: "JOB_ALERT_CONFIRMATION",
          description: `Confirm job alerts dispatch to ${email} for role "${role || "all"}" (${frequency || "Daily"})?`,
          confirmationToken: token,
          actionTaken: "Awaiting confirmation before activating job alerts.",
        };
      }

      return {
        success: true,
        email,
        role,
        location,
        remote,
        frequency,
        actionTaken: `Configured verified job alerts for ${email}`,
      };
    },
  }),

  deleteUserData: tool({
    description: "Permanently delete user profile data, resumes, or chat history. SENSITIVE: Irreversible action.",
    inputSchema: z.object({
      dataType: z.enum(["chat_history", "resumes", "account"]).describe("Data category to delete"),
      confirmed: z.boolean().default(false).describe("Whether user explicitly confirmed deletion"),
      confirmationToken: z.string().optional().describe("Signed confirmation token"),
    }),
    execute: async ({ dataType, confirmed, confirmationToken }) => {
      if (!confirmed || !confirmationToken || !verifyAndConsumeConfirmationToken(confirmationToken, "deleteUserData")) {
        const token = createConfirmationToken("deleteUserData", { dataType });
        return {
          success: false,
          requiresConfirmation: true,
          confirmationType: "DATA_DELETION",
          description: `⚠️ WARNING: This will permanently delete your ${dataType.replace("_", " ")}. This cannot be undone. Please confirm: Yes, delete it, or Cancel.`,
          confirmationToken: token,
          actionTaken: `Awaiting explicit confirmation before deleting ${dataType}.`,
        };
      }

      return {
        success: true,
        dataType,
        actionTaken: `Permanently deleted ${dataType} upon user confirmation.`,
      };
    },
  }),
};
