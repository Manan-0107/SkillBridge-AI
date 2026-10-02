/**
 * Self-check for the voice command parser. No framework — run with:
 *   npx tsx lib/voiceCommands.test.ts
 */
import assert from "node:assert/strict";
import { parseVoiceCommand, type VoiceCommand } from "./voiceCommands";

const cases: [string, Partial<VoiceCommand> | null][] = [
  ["go to resume", { feature: "resume", resumeTab: "analyzer" }],
  ["resume", { feature: "resume", resumeTab: "analyzer" }],
  ["analyze", { feature: "resume", resumeTab: "analyzer", action: "analyze" }],
  // analyze rule must win over the generic resume rule
  ["analyze my resume", { feature: "resume", action: "analyze" }],
  ["open roadmap", { feature: "roadmap" }],
  ["roadmap", { feature: "roadmap" }],
  ["practice", { feature: "practice" }],
  ["go home", { feature: "assistant" }],
  ["go back", { feature: "assistant" }],
  // case + surrounding whitespace are standardized away
  ["  PRACTICE  ", { feature: "practice" }],
  // fuzzy fallback (parseIntent) still handles the rest
  ["find courses for my role", { feature: "courses" }],
  ["show jobs near me", { feature: "local" }],
  ["asdfghjkl", null],
];

for (const [input, expected] of cases) {
  const got = parseVoiceCommand(input);
  if (expected === null) {
    assert.equal(got, null, `"${input}" → expected null, got ${JSON.stringify(got)}`);
    continue;
  }
  assert.ok(got, `"${input}" → expected a command, got null`);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(
      (got as Record<string, unknown>)[key],
      value,
      `"${input}" → ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(
        (got as Record<string, unknown>)[key]
      )}`
    );
  }
}

console.log(`voiceCommands: ${cases.length} cases passed`);
