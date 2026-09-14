/**
 * Self-check for the voice command parser. No framework — run with:
 *   npx tsx lib/voiceCommands.test.ts
 */
import assert from "node:assert/strict";
import { parseVoiceCommand, type VoiceCommand } from "./voiceCommands";

const cases: [string, Partial<VoiceCommand> | null][] = [
  ["go to resume", { kind: "navigate", feature: "resume", resumeTab: "analyzer" }],
  ["resume", { kind: "navigate", feature: "resume", resumeTab: "analyzer" }],
  ["analyze", { kind: "navigate", feature: "resume", resumeTab: "analyzer", action: "analyze" }],
  // analyze rule must win over the generic resume rule
  ["analyze my resume", { kind: "navigate", feature: "resume", action: "analyze" }],
  ["open roadmap", { kind: "navigate", feature: "roadmap" }],
  ["roadmap", { kind: "navigate", feature: "roadmap" }],
  ["practice", { kind: "navigate", feature: "practice" }],
  ["go home", { kind: "navigate", feature: "assistant" }],
  ["go back", { kind: "navigate", feature: "assistant" }],
  // case + surrounding whitespace are standardized away
  ["  PRACTICE  ", { kind: "navigate", feature: "practice" }],
  // fuzzy fallback (parseIntent) still handles the rest
  ["find courses for my role", { kind: "navigate", feature: "courses" }],
  ["show jobs near me", { kind: "navigate", feature: "local" }],
  // unrecognised speech is handed to the AI assistant, not dropped
  ["asdfghjkl", { kind: "assistant", query: "asdfghjkl" }],
  // ...only genuinely empty input is a no-op
  ["   ", null],
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
