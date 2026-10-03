/**
 * lib/career/skillGraph.ts
 *
 * UBIX Canonical Skill Graph
 *
 * Provides normalized, ontology-backed skill relationships:
 * - Skill Aliases (e.g., "React.js" -> "react", "NodeJS" -> "node.js")
 * - Prerequisites (e.g., "react" requires ["javascript", "html", "css"])
 * - Related Skills (e.g., "react" relates to ["next.js", "redux", "tailwind"])
 * - Complementary Skills (e.g., "backend" complements "frontend" -> full-stack)
 * - Category classification & difficulty rating
 *
 * Invariant: Prevents duplicate skill nodes through canonical normalization.
 */

export interface CanonicalSkill {
  id: string;
  name: string;
  category: "FRONTEND" | "BACKEND" | "DEVOPS" | "DATA" | "MOBILE" | "AI_ML" | "SOFT_SKILL" | "SYSTEMS";
  aliases: string[];
  prerequisites: string[]; // Skill IDs
  relatedSkills: string[]; // Skill IDs
  complementarySkills: string[]; // Skill IDs
  difficultyLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  description: string;
}

const SKILL_REGISTRY: Record<string, CanonicalSkill> = {
  javascript: {
    id: "javascript",
    name: "JavaScript",
    category: "FRONTEND",
    aliases: ["js", "es6", "ecmascript"],
    prerequisites: ["html", "css"],
    relatedSkills: ["typescript", "react", "node.js"],
    complementarySkills: ["python", "sql"],
    difficultyLevel: "BEGINNER",
    description: "Core dynamic scripting language of the web platform.",
  },
  typescript: {
    id: "typescript",
    name: "TypeScript",
    category: "FRONTEND",
    aliases: ["ts"],
    prerequisites: ["javascript"],
    relatedSkills: ["react", "node.js", "next.js"],
    complementarySkills: ["go", "rust"],
    difficultyLevel: "INTERMEDIATE",
    description: "Typed superset of JavaScript providing static type guarantees.",
  },
  react: {
    id: "react",
    name: "React",
    category: "FRONTEND",
    aliases: ["react.js", "reactjs"],
    prerequisites: ["javascript", "html", "css"],
    relatedSkills: ["next.js", "redux", "tailwind"],
    complementarySkills: ["node.js", "rest_api"],
    difficultyLevel: "INTERMEDIATE",
    description: "Component-based declarative UI library.",
  },
  "next.js": {
    id: "next.js",
    name: "Next.js",
    category: "FRONTEND",
    aliases: ["nextjs", "next"],
    prerequisites: ["react", "typescript"],
    relatedSkills: ["react", "tailwind", "node.js"],
    complementarySkills: ["postgresql", "redis"],
    difficultyLevel: "INTERMEDIATE",
    description: "Full-stack React framework with server-side rendering and static generation.",
  },
  "node.js": {
    id: "node.js",
    name: "Node.js",
    category: "BACKEND",
    aliases: ["nodejs", "node"],
    prerequisites: ["javascript"],
    relatedSkills: ["express", "typescript", "rest_api"],
    complementarySkills: ["postgresql", "docker", "redis"],
    difficultyLevel: "INTERMEDIATE",
    description: "Asynchronous event-driven JavaScript runtime for scalable backend services.",
  },
  python: {
    id: "python",
    name: "Python",
    category: "BACKEND",
    aliases: ["py", "python3"],
    prerequisites: [],
    relatedSkills: ["fastapi", "django", "data_structures"],
    complementarySkills: ["sql", "docker", "machine_learning"],
    difficultyLevel: "BEGINNER",
    description: "High-level readable programming language widely used in backend, scripting, and AI.",
  },
  postgresql: {
    id: "postgresql",
    name: "PostgreSQL",
    category: "DATA",
    aliases: ["postgres", "pg"],
    prerequisites: ["sql"],
    relatedSkills: ["sql", "redis", "database_design"],
    complementarySkills: ["node.js", "python", "docker"],
    difficultyLevel: "INTERMEDIATE",
    description: "Advanced open-source relational database supporting JSONB and vector search.",
  },
  docker: {
    id: "docker",
    name: "Docker",
    category: "DEVOPS",
    aliases: ["containers", "containerization"],
    prerequisites: ["linux_basics"],
    relatedSkills: ["kubernetes", "ci_cd"],
    complementarySkills: ["node.js", "postgresql", "python"],
    difficultyLevel: "INTERMEDIATE",
    description: "Container platform for packaging and deploying isolated microservices.",
  },
  html: {
    id: "html",
    name: "HTML5",
    category: "FRONTEND",
    aliases: ["html5", "semantic_html"],
    prerequisites: [],
    relatedSkills: ["css", "javascript", "web_accessibility"],
    complementarySkills: ["seo"],
    difficultyLevel: "BEGINNER",
    description: "Semantic structural markup language of the World Wide Web.",
  },
  css: {
    id: "css",
    name: "CSS3",
    category: "FRONTEND",
    aliases: ["css3", "styling"],
    prerequisites: ["html"],
    relatedSkills: ["tailwind", "responsive_design"],
    complementarySkills: ["javascript"],
    difficultyLevel: "BEGINNER",
    description: "Style sheet language for responsive presentation and visual design.",
  },
  sql: {
    id: "sql",
    name: "SQL",
    category: "DATA",
    aliases: ["structured_query_language"],
    prerequisites: [],
    relatedSkills: ["postgresql", "database_design"],
    complementarySkills: ["python", "node.js"],
    difficultyLevel: "BEGINNER",
    description: "Domain-specific language used in programming and managing data held in an RDBMS.",
  },
  web_accessibility: {
    id: "web_accessibility",
    name: "Web Accessibility (a11y)",
    category: "FRONTEND",
    aliases: ["a11y", "wcag", "aria"],
    prerequisites: ["html"],
    relatedSkills: ["semantic_html", "css", "screen_readers"],
    complementarySkills: ["react", "testing"],
    difficultyLevel: "INTERMEDIATE",
    description: "Inclusive engineering ensuring web systems are usable by people of all abilities.",
  },
};

/**
 * Normalizes any free-form skill name into its canonical Skill ID.
 */
export function normalizeSkillName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "";

  const clean = rawName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ");

  // Direct ID match
  if (SKILL_REGISTRY[clean]) {
    return clean;
  }

  // Check aliases
  for (const skill of Object.values(SKILL_REGISTRY)) {
    if (skill.name.toLowerCase() === clean) return skill.id;
    if (skill.aliases.includes(clean)) return skill.id;
  }

  // Fallback to normalized slug
  return clean.replace(/\s+/g, "_");
}

/**
 * Retrieves canonical skill definition if registered.
 */
export function getSkillDefinition(skillIdOrName: string): CanonicalSkill | null {
  const normalizedId = normalizeSkillName(skillIdOrName);
  return SKILL_REGISTRY[normalizedId] || null;
}

/**
 * Computes prerequisite chain for a target skill.
 */
export function getSkillPrerequisites(skillIdOrName: string): CanonicalSkill[] {
  const root = getSkillDefinition(skillIdOrName);
  if (!root) return [];

  const visited = new Set<string>();
  const prerequisites: CanonicalSkill[] = [];

  function traverse(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const s = SKILL_REGISTRY[id];
    if (!s) return;

    for (const prereqId of s.prerequisites) {
      const p = SKILL_REGISTRY[prereqId];
      if (p && !visited.has(prereqId)) {
        prerequisites.push(p);
        traverse(prereqId);
      }
    }
  }

  traverse(root.id);
  return prerequisites;
}

/**
 * Identifies complementary and related skills to expand candidate breadth.
 */
export function getRecommendedNextSkills(knownSkillIds: string[]): CanonicalSkill[] {
  const knownSet = new Set(knownSkillIds.map(normalizeSkillName));
  const candidateScores = new Map<string, number>();

  for (const id of knownSet) {
    const skill = SKILL_REGISTRY[id];
    if (!skill) continue;

    // Related skills get score boost
    for (const related of skill.relatedSkills) {
      if (!knownSet.has(related)) {
        candidateScores.set(related, (candidateScores.get(related) || 0) + 2);
      }
    }
    // Complementary skills get score boost
    for (const comp of skill.complementarySkills) {
      if (!knownSet.has(comp)) {
        candidateScores.set(comp, (candidateScores.get(comp) || 0) + 3);
      }
    }
  }

  return Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => SKILL_REGISTRY[id])
    .filter(Boolean)
    .slice(0, 5);
}
