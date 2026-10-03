/**
 * lib/projects/projectBuilder.ts
 *
 * UBIX Project Builder
 *
 * Translates identified skill gaps and target career goals into practical,
 * production-realistic project specifications that produce verifiable portfolio evidence.
 *
 * Pipeline Flow:
 * Project Spec → Milestone Deliverables → Skill Evidence → Portfolio → Resume → Job Match
 */

import { getSkillDefinition, normalizeSkillName } from "../career/skillGraph";

export interface ProjectMilestone {
  order: number;
  title: string;
  deliverable: string;
  technologies: string[];
  evidenceGenerated: string;
  estimatedHours: number;
}

export interface ProjectProposal {
  id: string;
  title: string;
  targetRoleTitle: string;
  primarySkillGap: string;
  overview: string;
  architectureDescription: string;
  technologies: string[];
  learningObjectives: string[];
  milestones: ProjectMilestone[];
  totalEstimatedHours: number;
  expectedPortfolioArtifact: string;
  provenance: "GENERATED_PROJECT_SPEC";
}

/**
 * Generates an end-to-end project specification targeting a specific skill gap and role.
 */
export function buildProjectProposal(input: {
  targetRoleTitle: string;
  skillGap: string;
  difficulty?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}): ProjectProposal {
  const normSkill = normalizeSkillName(input.skillGap);
  const skillDef = getSkillDefinition(normSkill);
  const skillName = skillDef?.name || input.skillGap;

  let title = `${skillName} Service Implementation`;
  let overview = `Construct a production-ready application demonstrating ${skillName} capabilities.`;
  let technologies = [skillName, "TypeScript", "Node.js"];
  let milestones: ProjectMilestone[] = [];

  if (normSkill === "docker") {
    title = "Microservices Containerization & Orchestration Pipeline";
    overview =
      "Containerize a multi-service web platform with multi-stage Docker builds, health checks, and local docker-compose orchestration.";
    technologies = ["Docker", "Docker Compose", "Node.js", "PostgreSQL", "Nginx"];
    milestones = [
      {
        order: 1,
        title: "Multi-Stage Dockerfile Construction",
        deliverable: "Optimized Dockerfile utilizing layer caching and unprivileged non-root user execution.",
        technologies: ["Docker", "Linux"],
        evidenceGenerated: "Verified Dockerfile with minimal image size footprint.",
        estimatedHours: 4,
      },
      {
        order: 2,
        title: "Docker Compose Service Mesh",
        deliverable: "docker-compose.yml defining web server, background worker, PostgreSQL, and volume mounts.",
        technologies: ["Docker Compose", "PostgreSQL"],
        evidenceGenerated: "Isolated local network environment running multi-container stack.",
        estimatedHours: 6,
      },
      {
        order: 3,
        title: "Automated Container Health Probes",
        deliverable: "Configured interval health checks and graceful termination handling.",
        technologies: ["Bash", "Docker"],
        evidenceGenerated: "Self-healing container deployment with automated restart policy.",
        estimatedHours: 4,
      },
    ];
  } else if (normSkill === "postgresql") {
    title = "High-Throughput Relational Database & State Engine";
    overview =
      "Design an ACID-compliant PostgreSQL schema featuring JSONB audit logging, indexing optimizations, and atomic stored procedures.";
    technologies = ["PostgreSQL", "SQL", "Node.js", "Docker"];
    milestones = [
      {
        order: 1,
        title: "Relational Schema & Foreign Key Invariants",
        deliverable: "Normalized relational schema with strict constraints, indexes, and UUID primary keys.",
        technologies: ["SQL", "PostgreSQL"],
        evidenceGenerated: "SQL DDL migration script with zero data duplication.",
        estimatedHours: 5,
      },
      {
        order: 2,
        title: "Atomic JSONB Mutation Functions",
        deliverable: "PL/pgSQL security definer RPC functions executing atomic read-modify-write transactions.",
        technologies: ["PL/pgSQL", "PostgreSQL"],
        evidenceGenerated: "Verified stored procedures eliminating TOCTOU race conditions.",
        estimatedHours: 7,
      },
      {
        order: 3,
        title: "Query Profiling & Index Benchmarks",
        deliverable: "EXPLAIN ANALYZE execution plans verifying index scans on high-cardinality foreign keys.",
        technologies: ["SQL Execution Profiling"],
        evidenceGenerated: "Performance benchmark demonstrating sub-5ms query response times.",
        estimatedHours: 4,
      },
    ];
  } else if (normSkill === "react" || normSkill === "next.js") {
    title = "Accessible High-Performance Career Dashboard";
    overview =
      "Develop a fully accessible, keyboard-navigable dashboard featuring ARIA live region updates and dark Obsidian styling.";
    technologies = ["React", "Next.js", "TypeScript", "Tailwind CSS", "WCAG AA"];
    milestones = [
      {
        order: 1,
        title: "Accessible Component Architecture",
        deliverable: "Component hierarchy implementing semantic HTML landmarks, labels, and visible focus rings.",
        technologies: ["React", "HTML5", "ARIA"],
        evidenceGenerated: "WCAG AA compliant component library with zero keyboard traps.",
        estimatedHours: 6,
      },
      {
        order: 2,
        title: "Live Region State Announcements",
        deliverable: "Screen-reader polite announcements for asynchronous data fetching and form state updates.",
        technologies: ["React", "Web Accessibility"],
        evidenceGenerated: "Dynamic live updates announced seamlessly to assistive technologies.",
        estimatedHours: 5,
      },
      {
        order: 3,
        title: "Responsive Dark Obsidian Layout",
        deliverable: "Tailwind design system implementation respecting reduced-motion and high-contrast modes.",
        technologies: ["Tailwind CSS", "CSS3"],
        evidenceGenerated: "Fluid responsive layout scoring 100 on Lighthouse accessibility audits.",
        estimatedHours: 4,
      },
    ];
  } else {
    milestones = [
      {
        order: 1,
        title: `Core ${skillName} Fundamentals Implementation`,
        deliverable: `Working code module exercising primary ${skillName} paradigms.`,
        technologies: [skillName],
        evidenceGenerated: `Unit-tested ${skillName} code repository.`,
        estimatedHours: 6,
      },
      {
        order: 2,
        title: `Integration & Error Resilience`,
        deliverable: `Production-safe error boundaries and comprehensive input validation.`,
        technologies: [skillName, "TypeScript"],
        evidenceGenerated: `Documented project artifact demonstrating error resilience.`,
        estimatedHours: 6,
      },
    ];
  }

  const totalHours = milestones.reduce((acc, m) => acc + m.estimatedHours, 0);

  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    title,
    targetRoleTitle: input.targetRoleTitle,
    primarySkillGap: skillName,
    overview,
    architectureDescription: `Modular microservices architecture demonstrating ${skillName} in production-like environments.`,
    technologies,
    learningObjectives: [
      `Demonstrate production mastery of ${skillName}.`,
      "Enforce rigorous automated testing and typed error boundaries.",
      "Produce a demonstrable GitHub artifact to add to the Career Evidence Wallet.",
    ],
    milestones,
    totalEstimatedHours: totalHours,
    expectedPortfolioArtifact: `GitHub repository containing code, test coverage, and documentation for ${title}.`,
    provenance: "GENERATED_PROJECT_SPEC",
  };
}
