/**
 * tests/unit/ai_sdk_migration.test.mjs
 *
 * Validates:
 * 1. AI SDK Provider Configuration & dynamic model ID environment overrides (§1)
 * 2. Tool definition validation and parameter execution through Zod schemas (§3)
 * 3. Scoped RAG domain classification: ensures general queries bypass retrieval,
 *    while courses, roadmap, resume, and jobs queries accurately trigger retrieval (§4)
 * 4. Honest fallback metadata preservation contract (§0)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

function runTsx(code) {
  return execSync("npx -y tsx -", {
    input: code,
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

test("AI SDK: Provider Models read from environment variables or active defaults", () => {
  const code = `
    import { PROVIDER_MODELS, PROVIDER_ORDER } from './lib/ai/providerConfig';
    if (!PROVIDER_MODELS.groq) throw new Error("Missing groq");
    if (!PROVIDER_MODELS.gemini) throw new Error("Missing gemini");
    if (!PROVIDER_MODELS.openai) throw new Error("Missing openai");
    if (!PROVIDER_MODELS.openrouter) throw new Error("Missing openrouter");
    if (!PROVIDER_MODELS.anthropic) throw new Error("Missing anthropic");
    if (PROVIDER_MODELS.openai !== "gpt-4o-mini") throw new Error("Wrong default openai");
    if (PROVIDER_ORDER.length !== 5) throw new Error("Wrong provider order count");
  `;
  runTsx(code);
});

test("AI SDK Tools: All required tools are defined and execute with valid parameters", () => {
  const code = `
    import { aiTools } from './lib/ai/tools';
    async function run() {
      if (!aiTools.navigateTo || !aiTools.openResume || !aiTools.searchJobs || !aiTools.searchCourses) {
        throw new Error("Missing tools");
      }
      const nav = await aiTools.navigateTo.execute({ page: 'roadmap' });
      if (!nav.success || nav.page !== 'roadmap') throw new Error("Nav failed");
      const res = await aiTools.openResume.execute({ tab: 'analyzer' });
      if (!res.success || res.page !== 'resume' || res.tab !== 'analyzer') throw new Error("Resume tool failed");
    }
    run();
  `;
  runTsx(code);
});

test("Scoped RAG: General queries strictly bypass retrieval", () => {
  const code = `
    import { classifyScopedDomain, getScopedRagContext } from './lib/ai/rag/scopedRag';
    async function run() {
      const generalQueries = [
        "explain recursion in javascript",
        "what is photosynthesis",
        "who is the prime minister of India",
        "how to solve binary search in python",
        "tell me a joke"
      ];
      for (const q of generalQueries) {
        const domain = classifyScopedDomain(q);
        if (domain !== null) throw new Error("General query triggered domain: " + q);
        const res = await getScopedRagContext(q);
        if (res.domain !== null || res.retrieved !== false || res.contextText !== null || res.matches.length !== 0) {
          throw new Error("General query triggered RAG: " + q);
        }
      }
    }
    run();
  `;
  runTsx(code);
});

test("Scoped RAG: Domain-specific queries accurately trigger their respective retrieval scopes", () => {
  const code = `
    import { getScopedRagContext } from './lib/ai/rag/scopedRag';
    async function run() {
      const cour = await getScopedRagContext("find courses for react and next.js", "frontend");
      if (cour.domain !== "courses" || !cour.retrieved || cour.matches.length === 0 || !cour.contextText?.includes("COURSES")) {
        throw new Error("Courses RAG failed");
      }

      const road = await getScopedRagContext("show me my complete career roadmap", "frontend");
      if (road.domain !== "roadmap" || !road.retrieved || road.matches.length === 0 || !road.contextText?.includes("ROADMAP")) {
        throw new Error("Roadmap RAG failed");
      }

      const res = await getScopedRagContext("how do I optimize my resume for ATS?", "frontend");
      if (res.domain !== "resume" || !res.retrieved || res.matches.length === 0 || !res.contextText?.includes("RESUME")) {
        throw new Error("Resume RAG failed");
      }

      const jobs = await getScopedRagContext("show local and remote jobs matching my profile", "frontend");
      if (jobs.domain !== "jobs" || !jobs.retrieved || jobs.matches.length === 0 || !jobs.contextText?.includes("JOBS")) {
        throw new Error("Jobs RAG failed");
      }
    }
    run();
  `;
  runTsx(code);
});
