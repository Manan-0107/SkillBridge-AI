/**
 * tests/voiceCommandRouter.test.ts
 *
 * Reproduces the intent-pipeline gap in the persistent voice layer.
 *
 * Today every recognised utterance is routed through `parseVoiceCommand`
 * (context/VoiceContext.tsx -> routeCommand):
 *
 *     const command = parseVoiceCommand(spoken);
 *     if (!command) return;              // <-- dead end
 *
 * Anything the hand-written RULES / parseIntent keywords don't match returns
 * `null` and is silently swallowed: it never navigates, never gets a spoken
 * acknowledgement, and — the point of overhaul requirement #2 — is never
 * handed to the in-house AI assistant (/api/assistant/chat).
 *
 * A spec-compliant router must return a discriminated result:
 *   { kind: "navigate",  feature, label }        -> programmatic route change
 *   { kind: "assistant", query,   label }        -> hand off to the AI assistant
 *   null                                         -> only for empty/no speech
 *
 * Run:  npx tsx tests/voiceCommandRouter.test.ts
 */
import assert from "node:assert/strict";
import { parseVoiceCommand } from "../lib/voiceCommands";

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}\n       ${(err as Error).message}`);
  }
}

// ── 1. Natural navigation phrasing must resolve to a route ──────────────────
// "go home" works today; these equivalent phrasings all fall through to null.
for (const phrase of ["go to home", "open the assistant", "take me to the home page"]) {
  check(`navigate -> "${phrase}"`, () => {
    const cmd = parseVoiceCommand(phrase) as any;
    assert.ok(cmd, "dropped: parseVoiceCommand returned null");
    assert.equal(cmd.kind, "navigate", `expected kind "navigate", got ${JSON.stringify(cmd.kind)}`);
    assert.equal(cmd.feature, "assistant");
  });
}

// ── 2. Unmatched speech must be handed to the AI assistant, never dropped ───
for (const phrase of [
  "where am i",
  "read this page to me",
  "what can this app do for me",
  "help me sign in",
]) {
  check(`assistant handoff -> "${phrase}"`, () => {
    const cmd = parseVoiceCommand(phrase) as any;
    assert.ok(cmd, "dropped: utterance never reaches /api/assistant/chat");
    assert.equal(cmd.kind, "assistant", `expected kind "assistant", got ${JSON.stringify(cmd.kind)}`);
    assert.equal(cmd.query, phrase);
  });
}

// ── 3. Existing explicit commands keep working, now tagged as navigation ────
for (const [phrase, feature] of [
  ["go to resume", "resume"],
  ["open roadmap", "roadmap"],
  ["practice", "practice"],
] as const) {
  check(`navigate -> "${phrase}" (regression)`, () => {
    const cmd = parseVoiceCommand(phrase) as any;
    assert.ok(cmd);
    assert.equal(cmd.kind, "navigate");
    assert.equal(cmd.feature, feature);
  });
}

// ── 4. Genuinely empty input stays a no-op ─────────────────────────────────
check("empty input -> null", () => {
  assert.equal(parseVoiceCommand("   "), null);
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
