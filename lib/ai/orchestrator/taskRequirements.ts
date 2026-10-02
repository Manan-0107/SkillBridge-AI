/**
 * lib/ai/orchestrator/taskRequirements.ts
 *
 * UBIX Dynamic Task Requirements Registry:
 * Tasks dynamically declare what they need given the user's situation and current context.
 * NOT static question lists.
 */

import { InformationRequirement, InformationResolutionContext } from "./informationModel";

export type TaskId =
  | "generate_roadmap"
  | "modify_roadmap"
  | "continue_roadmap"
  | "build_resume"
  | "tailor_resume"
  | "audit_resume"
  | "find_jobs"
  | "start_practice"
  | "adaptive_assessment"
  | "general_inquiry"
  | "onboarding";

export interface TaskDefinition {
  id: TaskId;
  name: string;
  category: "roadmap" | "resume" | "jobs" | "practice" | "general" | "onboarding";
  resolveRequirements: (context: InformationResolutionContext) => InformationRequirement[];
  canExecuteDirectly: (resolvedRequirements: InformationRequirement[]) => boolean;
  executeActionDescription: string;
}

export const TASK_REGISTRY: Record<TaskId, TaskDefinition> = {
  // ── 1. Roadmap Generation ──
  generate_roadmap: {
    id: "generate_roadmap",
    name: "Generate Career Roadmap",
    category: "roadmap",
    resolveRequirements: (context) => {
      const reqs: InformationRequirement[] = [
        {
          key: "targetRole",
          description: "Target career path or job title",
          importance: "critical",
          requiredFor: ["generate_roadmap"],
          dependencies: [],
          status: "UNKNOWN",
          confidence: 0,
        },
        {
          key: "experienceLevel",
          description: "Current technical experience level (e.g. beginner, intermediate, switching careers)",
          importance: "high",
          requiredFor: ["generate_roadmap"],
          dependencies: ["targetRole"],
          status: "UNKNOWN",
          confidence: 0,
          skipAllowed: true,
        },
        {
          key: "availableLearningTime",
          description: "Hours per week available for study and project work",
          importance: "high",
          requiredFor: ["generate_roadmap"],
          dependencies: ["targetRole"],
          status: "UNKNOWN",
          confidence: 0,
          skipAllowed: true,
        },
      ];

      // If user is switching careers, add previous background as a helpful dynamic requirement
      if (
        context.userProfile?.learningGoal?.toLowerCase().includes("switch") ||
        context.knownInformation?.isCareerSwitcher
      ) {
        reqs.push({
          key: "previousBackground",
          description: "Prior technical background or current stack to accelerate learning transition",
          importance: "medium",
          requiredFor: ["generate_roadmap"],
          dependencies: ["targetRole"],
          status: "UNKNOWN",
          confidence: 0,
          skipAllowed: true,
        });
      }

      return reqs;
    },
    canExecuteDirectly: (resolved) => {
      const targetRoleReq = resolved.find((r) => r.key === "targetRole");
      // Critical minimum to generate a functional roadmap is targetRole
      return Boolean(targetRoleReq && (targetRoleReq.status === "KNOWN" || targetRoleReq.status === "CONFIRMED"));
    },
    executeActionDescription: "Generating dynamic milestone-based career roadmap for target role.",
  },

  // ── 2. Modify Roadmap ──
  modify_roadmap: {
    id: "modify_roadmap",
    name: "Modify Existing Roadmap",
    category: "roadmap",
    resolveRequirements: (_context) => [
      {
        key: "roadmapModificationGoal",
        description: "How to adjust the roadmap (e.g. increase pace, change target date, add specific technology)",
        importance: "critical",
        requiredFor: ["modify_roadmap"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
      },
    ],
    canExecuteDirectly: (resolved) => {
      const modReq = resolved.find((r) => r.key === "roadmapModificationGoal");
      return Boolean(modReq && (modReq.status === "KNOWN" || modReq.status === "CONFIRMED"));
    },
    executeActionDescription: "Adapting roadmap milestones and pace according to your preferences.",
  },

  // ── 3. Continue Roadmap ──
  continue_roadmap: {
    id: "continue_roadmap",
    name: "Continue Existing Roadmap",
    category: "roadmap",
    resolveRequirements: () => [], // Needs zero additional questions
    canExecuteDirectly: () => true,
    executeActionDescription: "Continuing with current roadmap progress and next scheduled topic.",
  },

  // ── 4. Build Resume ──
  build_resume: {
    id: "build_resume",
    name: "Build Conversational Resume",
    category: "resume",
    resolveRequirements: () => [
      {
        key: "fullName",
        description: "Candidate full name",
        importance: "critical",
        requiredFor: ["build_resume"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
      },
      {
        key: "email",
        description: "Contact email address",
        importance: "critical",
        requiredFor: ["build_resume"],
        dependencies: ["fullName"],
        status: "UNKNOWN",
        confidence: 0,
        confirmationRequired: true,
      },
      {
        key: "location",
        description: "Current city or region",
        importance: "medium",
        requiredFor: ["build_resume"],
        dependencies: ["email"],
        status: "UNKNOWN",
        confidence: 0,
        skipAllowed: true,
      },
      {
        key: "targetRole",
        description: "Target job title for the resume",
        importance: "critical",
        requiredFor: ["build_resume"],
        dependencies: ["fullName"],
        status: "UNKNOWN",
        confidence: 0,
      },
      {
        key: "skills",
        description: "Core technical skills and tools",
        importance: "high",
        requiredFor: ["build_resume"],
        dependencies: ["targetRole"],
        status: "UNKNOWN",
        confidence: 0,
        skipAllowed: true,
      },
      {
        key: "experience",
        description: "Summary of relevant experience, past roles, or self-directed projects",
        importance: "high",
        requiredFor: ["build_resume"],
        dependencies: ["skills"],
        status: "UNKNOWN",
        confidence: 0,
        skipAllowed: true,
      },
    ],
    canExecuteDirectly: (resolved) => {
      const name = resolved.find((r) => r.key === "fullName");
      const role = resolved.find((r) => r.key === "targetRole");
      return (
        Boolean(name && (name.status === "KNOWN" || name.status === "CONFIRMED")) &&
        Boolean(role && (role.status === "KNOWN" || role.status === "CONFIRMED"))
      );
    },
    executeActionDescription: "Synthesizing conversational resume draft in Resume Builder.",
  },

  // ── 5. Tailor Resume ──
  tailor_resume: {
    id: "tailor_resume",
    name: "Tailor Resume for Specific Opportunity",
    category: "resume",
    resolveRequirements: (context) => {
      const reqs: InformationRequirement[] = [
        {
          key: "targetJobDescription",
          description: "Target job description or key requirements to tailor against",
          importance: "critical",
          requiredFor: ["tailor_resume"],
          dependencies: [],
          status: "UNKNOWN",
          confidence: 0,
        },
      ];
      // If user has no existing resume text or profile resume, ask for it
      if (!context.knownInformation?.activeResumeText && !context.userProfile?.skills?.length) {
        reqs.unshift({
          key: "existingResumeText",
          description: "Your current resume text or past work experience",
          importance: "critical",
          requiredFor: ["tailor_resume"],
          dependencies: [],
          status: "UNKNOWN",
          confidence: 0,
        });
      }
      return reqs;
    },
    canExecuteDirectly: (resolved) => {
      const targetJob = resolved.find((r) => r.key === "targetJobDescription");
      return Boolean(targetJob && (targetJob.status === "KNOWN" || targetJob.status === "CONFIRMED"));
    },
    executeActionDescription: "Tailoring resume keywords and accomplishments for the target role.",
  },

  // ── 6. Audit Resume ──
  audit_resume: {
    id: "audit_resume",
    name: "Audit Resume for ATS Compliance",
    category: "resume",
    resolveRequirements: () => [
      {
        key: "resumeContent",
        description: "Resume document or pasted text to audit",
        importance: "critical",
        requiredFor: ["audit_resume"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
      },
    ],
    canExecuteDirectly: (resolved) => {
      const content = resolved.find((r) => r.key === "resumeContent");
      return Boolean(content && (content.status === "KNOWN" || content.status === "CONFIRMED"));
    },
    executeActionDescription: "Running multi-engine ATS audit and skill gap scoring.",
  },

  // ── 7. Find Jobs ──
  find_jobs: {
    id: "find_jobs",
    name: "Discover Matching Jobs",
    category: "jobs",
    resolveRequirements: () => [
      {
        key: "targetRole",
        description: "Target job title or domain",
        importance: "critical",
        requiredFor: ["find_jobs"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
      },
      {
        key: "location",
        description: "Preferred city or remote work mode",
        importance: "medium",
        requiredFor: ["find_jobs"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
        skipAllowed: true,
      },
      {
        key: "workMode",
        description: "Remote, hybrid, or onsite preference",
        importance: "optional",
        requiredFor: ["find_jobs"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
        skipAllowed: true,
      },
    ],
    canExecuteDirectly: (resolved) => {
      const role = resolved.find((r) => r.key === "targetRole");
      return Boolean(role && (role.status === "KNOWN" || role.status === "CONFIRMED"));
    },
    executeActionDescription: "Querying live local and remote job opportunities.",
  },

  // ── 8. Start Practice / Assessment ──
  start_practice: {
    id: "start_practice",
    name: "Start Technical Practice Session",
    category: "practice",
    resolveRequirements: (context) => {
      const reqs: InformationRequirement[] = [
        {
          key: "practiceTopic",
          description: "Topic or programming language to practice",
          importance: "critical",
          requiredFor: ["start_practice"],
          dependencies: [],
          status: "UNKNOWN",
          confidence: 0,
        },
      ];

      // If user has practice history with struggling concepts, inject as a contextual default
      if (context.practiceHistory?.struggledConcepts?.length) {
        reqs[0].currentValue = context.practiceHistory.struggledConcepts[0];
        reqs[0].confidence = 0.85;
        reqs[0].source = "practice_history";
      }

      return reqs;
    },
    canExecuteDirectly: (resolved) => {
      const topic = resolved.find((r) => r.key === "practiceTopic");
      return Boolean(topic && (topic.status === "KNOWN" || topic.status === "CONFIRMED"));
    },
    executeActionDescription: "Launching adaptive technical practice drill.",
  },

  // ── 9. Adaptive Assessment ──
  adaptive_assessment: {
    id: "adaptive_assessment",
    name: "Run Concept-Specific Adaptive Assessment",
    category: "practice",
    resolveRequirements: () => [
      {
        key: "assessmentDomain",
        description: "Skill domain or concept focus",
        importance: "critical",
        requiredFor: ["adaptive_assessment"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
      },
    ],
    canExecuteDirectly: (resolved) => {
      const domain = resolved.find((r) => r.key === "assessmentDomain");
      return Boolean(domain && (domain.status === "KNOWN" || domain.status === "CONFIRMED"));
    },
    executeActionDescription: "Starting adaptive mastery assessment.",
  },

  // ── 10. General Inquiry ──
  general_inquiry: {
    id: "general_inquiry",
    name: "General Assistance",
    category: "general",
    resolveRequirements: () => [],
    canExecuteDirectly: () => true,
    executeActionDescription: "Answering inquiry directly.",
  },

  // ── 11. Onboarding ──
  onboarding: {
    id: "onboarding",
    name: "User Welcome & Orientation",
    category: "onboarding",
    resolveRequirements: () => [
      {
        key: "name",
        description: "Preferred name or greeting",
        importance: "high",
        requiredFor: ["onboarding"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
        skipAllowed: true,
      },
      {
        key: "targetRole",
        description: "Career ambition or target role",
        importance: "critical",
        requiredFor: ["onboarding"],
        dependencies: [],
        status: "UNKNOWN",
        confidence: 0,
      },
    ],
    canExecuteDirectly: (resolved) => {
      const role = resolved.find((r) => r.key === "targetRole");
      return Boolean(role && (role.status === "KNOWN" || role.status === "CONFIRMED"));
    },
    executeActionDescription: "Setting up tailored profile and workspace.",
  },
};
