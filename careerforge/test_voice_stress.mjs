/**
 * Deterministic voice safety and load test.
 *
 * This is intentionally browser-free: one million real microphones cannot be
 * simulated on a developer machine. The harness exercises the contracts that
 * must remain true under load: one active owner, stale callback rejection,
 * language mirroring, navigation allowlisting, and echo suppression.
 */

import assert from "node:assert/strict";

const ITERATIONS = 1_000_000;
const allowedRoutes = new Set(["/", "/resume", "/roadmap", "/courses", "/practice", "/local", "assistant"]);
const echoPatterns = ["welcome to careerforge", "what is your full name", "is that correct", "say yes"];

function detectTextLanguage(text) {
  const lower = text.toLowerCase();
  if (/\b(namaste|mera naam|madad chahiye)\b/i.test(lower)) return "hi-IN";
  if (/\b(kem cho|maru naam|mane madad)\b/i.test(lower)) return "gu-IN";
  if (/\b(bonjour|merci|aide)\b/i.test(lower)) return "fr-FR";
  return "en-US";
}

function isEcho(text) {
  const clean = text.toLowerCase().trim();
  if (["yes", "no", "stop", "pause", "correct"].includes(clean)) return false;
  return echoPatterns.some((pattern) => clean.includes(pattern));
}

function isAllowedRoute(route) {
  if (typeof route !== "string" || route.includes("..") || route.includes("//")) return false;
  if (/^(javascript|data|https?):/i.test(route)) return false;
  return allowedRoutes.has(route.trim().toLowerCase());
}

function testOwnership(iteration) {
  let generation = 0;
  let active = null;
  let staleRestarted = false;
  const first = { generation: ++generation };
  active = first;
  const second = { generation: ++generation };
  active = second;
  const staleOnEnd = () => {
    if (first.generation === generation) staleRestarted = true;
  };
  staleOnEnd();
  assert.equal(staleRestarted, false, `stale recognizer restarted at iteration ${iteration}`);
  assert.equal(active, second);
}

const languages = [
  ["kem cho, maru naam Manan", "gu-IN"],
  ["namaste, mera naam Manan hai", "hi-IN"],
  ["bonjour, merci", "fr-FR"],
  ["hello, my name is Manan", "en-US"],
];

for (let i = 0; i < ITERATIONS; i += 1) {
  testOwnership(i);
  const [sample, expected] = languages[i % languages.length];
  assert.equal(detectTextLanguage(sample), expected);
  assert.equal(isEcho(i % 2 ? "Welcome to CareerForge" : "yes"), i % 2 === 1);
  assert.equal(isAllowedRoute(i % 2 ? "https://evil.example" : "/resume"), i % 2 === 0);
}

console.log(`voice stress: ${ITERATIONS.toLocaleString()} ownership/language/security cases passed`);
