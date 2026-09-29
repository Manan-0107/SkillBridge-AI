/**
 * lib/ai/rag/scopedRag.ts
 *
 * Scoped RAG Retrieval Layer for CareerForge.
 * Restricts vector and domain retrieval strictly to 4 domains:
 * 1. Courses
 * 2. Roadmap content
 * 3. Resume/ATS heuristics
 * 4. Job listings (Local/internships)
 *
 * General knowledge queries ("explain recursion", "photosynthesis", etc.)
 * strictly bypass retrieval to minimize latency and token overhead.
 */

import { parseIntent, FeatureId } from "../../intent";
import { courseCatalog, roadmaps } from "../../data";
import { RoleId } from "../../types";

export type ScopedDomain = "courses" | "roadmap" | "resume" | "jobs";

export interface RagMatch {
  id: string;
  title: string;
  content: string;
  similarity?: number;
  metadata?: Record<string, any>;
}

export interface ScopedRagResult {
  domain: ScopedDomain | null;
  retrieved: boolean;
  matches: RagMatch[];
  contextText: string | null;
}

// ─── Domain Classification via Intent Engine ─────────────────────────────────
export function classifyScopedDomain(query: string): ScopedDomain | null {
  const intent = parseIntent(query);
  switch (intent.feature) {
    case "courses":
      return "courses";
    case "roadmap":
      return "roadmap";
    case "resume":
      return "resume";
    case "local":
      return "jobs";
    default:
      return null;
  }
}

// ─── Seeded In-Memory Domain Knowledge (Fallback / Seed Corpus) ───────────────
const RESUME_HEURISTICS_CORPUS: RagMatch[] = [
  {
    id: "rh-1",
    title: "Action Verbs & Impact Lead",
    content:
      "Open every resume bullet with powerful past-tense action verbs: led, built, shipped, launched, architected, optimized, deployed, scaled, spearheaded. Avoid passive duties like 'responsible for' or 'assisted with'.",
    metadata: { category: "action_verbs" },
  },
  {
    id: "rh-2",
    title: "Quantification & Numerical Outcomes",
    content:
      "Quantify at least 50% of achievements with concrete metrics: percentages improved, latency reduced (ms), users reached, revenue impact ($), or hours saved per sprint.",
    metadata: { category: "quantification" },
  },
  {
    id: "rh-3",
    title: "Core ATS Section Hierarchy",
    content:
      "Ensure standard machine-readable section headings: Summary / Objective, Experience / Work History, Education, and Skills / Technologies. Avoid unconventional headers that parser models fail to recognize.",
    metadata: { category: "section_structure" },
  },
  {
    id: "rh-4",
    title: "Role Keyword Alignment",
    content:
      "Integrate exact industry-standard skill keywords that match job descriptions (e.g. React 19, TypeScript, Distributed Caching, Kubernetes). Contextualize keywords within project accomplishments rather than bare keyword stuffing.",
    metadata: { category: "keywords" },
  },
  {
    id: "rh-5",
    title: "Single Page Brevity & Length Signal",
    content:
      "For engineers with under 5 years of experience, maintain a tightly packed 1-page layout (350-600 words) with zero filler words or high school details.",
    metadata: { category: "formatting" },
  },
];

const JOB_LISTINGS_CORPUS: RagMatch[] = [
  {
    id: "job-1",
    title: "Frontend Engineer (React / Next.js)",
    content: "Worldwide Remote frontend engineer position focusing on React 19, Next.js App Router, TypeScript, and Web Vitals performance.",
    metadata: { role: "frontend", arrangement: "worldwide_remote" },
  },
  {
    id: "job-2",
    title: "Backend Services Engineer (Node / Distributed Systems)",
    content: "Remote backend engineer building high-throughput microservices in TypeScript, Go, PostgreSQL, Redis, and Kafka.",
    metadata: { role: "backend", arrangement: "country_remote" },
  },
  {
    id: "job-3",
    title: "Cloud & DevOps Platform Engineer (Kubernetes / Terraform)",
    content: "Platform engineering role managing multi-region Kubernetes clusters, CI/CD automated test gates, and infrastructure as code.",
    metadata: { role: "devops", arrangement: "remote" },
  },
  {
    id: "job-4",
    title: "Data Analyst & Insights Intern",
    content: "Internship opportunity for aspiring data professionals with Python, SQL, statistical modeling, and Tableau / PowerBI experience.",
    metadata: { role: "data", arrangement: "hybrid" },
  },
  {
    id: "job-5",
    title: "Software Engineering Intern (Summer 2026)",
    content: "Foundational software engineering internship focused on full-stack web applications, algorithmic problem solving, and API design.",
    metadata: { role: "general", arrangement: "onsite" },
  },
];

function getCoursesCorpus(targetRole?: string): RagMatch[] {
  const matches: RagMatch[] = [];
  const roles = (targetRole && courseCatalog[targetRole as RoleId] ? [targetRole as RoleId] : (Object.keys(courseCatalog) as RoleId[]));

  for (const r of roles) {
    const list = courseCatalog[r] || [];
    for (const c of list) {
      matches.push({
        id: `course-${r}-${c.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        title: c.title,
        content: `Course: ${c.title} by ${c.provider} (${c.level} level, rating: ${c.rating}/5.0). Direct link: ${c.url}`,
        metadata: { role: r, level: c.level, provider: c.provider, url: c.url },
      });
    }
  }
  return matches;
}

function getRoadmapCorpus(targetRole?: string): RagMatch[] {
  const matches: RagMatch[] = [];
  const roles = (targetRole && roadmaps[targetRole as RoleId] ? [targetRole as RoleId] : (Object.keys(roadmaps) as RoleId[]));

  for (const r of roles) {
    const steps = roadmaps[r] || [];
    steps.forEach((step, idx) => {
      matches.push({
        id: `roadmap-${r}-step-${idx + 1}`,
        title: `${step.title} (${r})`,
        content: `Step ${idx + 1}: ${step.title}. Details: ${step.detail}. Key skills: ${step.skills.join(", ")}.`,
        metadata: { role: r, stepOrder: idx + 1, skills: step.skills },
      });
    });
  }
  return matches;
}

// ─── Token TF-IDF Cosine Similarity for Local Resilient Matching ─────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function computeLocalSimilarity(queryTokens: string[], docText: string): number {
  const docTokens = tokenize(docText);
  if (!docTokens.length || !queryTokens.length) return 0;

  const docSet = new Set(docTokens);
  let matchCount = 0;
  for (const q of queryTokens) {
    if (docSet.has(q)) matchCount += 1;
  }
  return matchCount / Math.sqrt(queryTokens.length * docTokens.length);
}

function searchLocalCorpus(query: string, corpus: RagMatch[], limit = 4): RagMatch[] {
  const queryTokens = tokenize(query);
  const scored = corpus.map((doc) => ({
    ...doc,
    similarity: computeLocalSimilarity(queryTokens, `${doc.title} ${doc.content}`),
  }));

  // Sort descending by similarity
  scored.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  return scored.slice(0, limit);
}

// ─── Main Scoped RAG Retrieval Engine ─────────────────────────────────────────
export async function getScopedRagContext(
  query: string,
  targetRole?: string
): Promise<ScopedRagResult> {
  const domain = classifyScopedDomain(query);

  // General knowledge queries strictly bypass RAG
  if (!domain) {
    return {
      domain: null,
      retrieved: false,
      matches: [],
      contextText: null,
    };
  }

  // Attempt Supabase pgvector retrieval if available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (
    process.env.OPENAI_API_KEY &&
    supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes("placeholder")
  ) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      const rpcMap: Record<ScopedDomain, string> = {
        courses: "match_courses",
        roadmap: "match_roadmap",
        resume: "match_resume_heuristics",
        jobs: "match_jobs",
      };

      const { embed } = await import("ai");
      const { createOpenAI } = await import("@ai-sdk/openai");
      const embeddingModel = createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).textEmbeddingModel(
        process.env.EMBEDDING_MODEL_ID || "text-embedding-3-small"
      );

      const { embedding } = await embed({
        model: embeddingModel,
        value: query,
      });

      const { data, error } = await supabase.rpc(rpcMap[domain], {
        query_embedding: embedding,
        match_count: 4,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const matches: RagMatch[] = data.map((item: any) => ({
          id: String(item.id),
          title: item.title || item.rule_title || "Domain Match",
          content: item.content || item.guidance || item.detail || "",
          similarity: item.similarity,
        }));

        const contextText = formatContextBlock(domain, matches);
        return { domain, retrieved: true, matches, contextText };
      }
    } catch (err) {
      console.warn(`[Scoped RAG] Remote vector query for ${domain} bypassed, using local corpus:`, err);
    }
  }

  // Resilient Local In-Memory Retrieval
  let corpus: RagMatch[] = [];
  switch (domain) {
    case "courses":
      corpus = getCoursesCorpus(targetRole);
      break;
    case "roadmap":
      corpus = getRoadmapCorpus(targetRole);
      break;
    case "resume":
      corpus = RESUME_HEURISTICS_CORPUS;
      break;
    case "jobs":
      corpus = JOB_LISTINGS_CORPUS;
      break;
  }

  const matches = searchLocalCorpus(query, corpus, 2);
  const contextText = formatContextBlock(domain, matches);

  return {
    domain,
    retrieved: true,
    matches,
    contextText,
  };
}

function formatContextBlock(domain: ScopedDomain, matches: RagMatch[]): string {
  if (!matches.length) return "";
  const lines = matches
    .map((m, idx) => {
      const truncatedContent = m.content.length > 300 ? m.content.slice(0, 300) + "..." : m.content;
      return `[${idx + 1}] ${m.title}: ${truncatedContent}`;
    })
    .join("\n");
  return `\n=== RETRIEVED DOMAIN KNOWLEDGE (${domain.toUpperCase()}) ===\n${lines}\n=== END DOMAIN KNOWLEDGE ===\n`;
}
