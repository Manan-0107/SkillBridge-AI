import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVoiceCommand } from "../../lib/voiceCommands.ts";

test("Voice Commands: Canonical parser handles 13 routing and intent scenarios", () => {
  const cases = [
    ["go to resume", { feature: "resume", resumeTab: "analyzer" }],
    ["resume", { feature: "resume", resumeTab: "analyzer" }],
    ["analyze", { feature: "resume", resumeTab: "analyzer", action: "analyze" }],
    ["analyze my resume", { feature: "resume", action: "analyze" }],
    ["open roadmap", { feature: "roadmap" }],
    ["roadmap", { feature: "roadmap" }],
    ["practice", { feature: "practice" }],
    ["go home", { feature: "assistant" }],
    ["go back", { feature: "back" }],
    ["  PRACTICE  ", { feature: "practice" }],
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
        got[key],
        value,
        `"${input}" → ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(got[key])}`
      );
    }
  }
});
