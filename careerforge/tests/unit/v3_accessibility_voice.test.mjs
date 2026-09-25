import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

test("V3 Root Theme: globals.css sets body background to Cream (#FAF6F1) and text to Ink (#14110F)", () => {
  const cssPath = path.join(projectRoot, "app/globals.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  assert(
    css.includes("background-color: #FAF6F1;"),
    "globals.css body must have background-color #FAF6F1"
  );
  assert(
    css.includes("color: #14110F;"),
    "globals.css body must have color #14110F"
  );
});

test("V3 Accessibility: Profile types and defaults in lib/store.tsx", () => {
  const storePath = path.join(projectRoot, "lib/store.tsx");
  const code = fs.readFileSync(storePath, "utf-8");

  assert(code.includes('"blind_low_vision"'), "Must include blind_low_vision profile");
  assert(code.includes('"deaf_hard_of_hearing"'), "Must include deaf_hard_of_hearing profile");
  assert(code.includes('"standard"'), "Must include standard profile");
  assert(code.includes("accessibilityProfile"), "Must expose accessibilityProfile state");
});

test("V3 LLM Orchestrator: Dynamic fallback produces human responses with zero robotic boilerplate", () => {
  const pythonScript = `
import sys
import json
sys.path.insert(0, 'python_ai')
from llm_providers import llm_orchestrator

# Test 1: 'hello elevyn'
res1 = llm_orchestrator.generate(messages=[{"role": "user", "text": "hello elevyn"}])
assert "That is an insightful question" not in res1.reply, "Must not contain robotic intro"
assert "sterile definition" not in res1.reply, "Must not contain sterile boilerplate"
assert "elevenlabs" in res1.reply.lower() or "hello" in res1.reply.lower(), "Must address ElevenLabs/greeting"

# Test 2: general greeting
res2 = llm_orchestrator.generate(messages=[{"role": "user", "text": "hi"}], user_name="Alex")
assert "Alex" in res2.reply or "Hello" in res2.reply, "Must greet naturally"

# Test 3: coding query
res3 = llm_orchestrator.generate(messages=[{"role": "user", "text": "reverse an array in python"}])
assert "def reverse_array" in res3.reply or "reverse" in res3.reply, "Must provide code solution"

print(json.dumps({"status": "ok"}))
`;

  const output = execSync("python", {
    cwd: projectRoot,
    input: pythonScript,
    encoding: "utf-8",
  });

  const parsed = JSON.parse(output.trim());
  assert.equal(parsed.status, "ok");
});

test("V3 DialogueManager: Alexa-style echo confirmation loop", () => {
  const pythonScript = `
import sys
import json
sys.path.insert(0, 'python_ai')
from dialogue_manager import dialogue_manager

sess_id = "v3_sess_confirm"

# Step 1: user dictates name with confirmation enabled
r1 = dialogue_manager.process_utterance(sess_id, "my name is Jordan Rivera", require_confirmation=True)
assert r1.intent == "confirmation", f"Expected confirmation, got {r1.intent}"
assert "Jordan Rivera" in r1.reply_text, "Must echo back name in reply"
assert r1.requires_followup is True, "Must require confirmation followup"

# Step 2: user confirms with 'yes'
r2 = dialogue_manager.process_utterance(sess_id, "yes", require_confirmation=True)
assert r2.intent == "form_input", f"Expected form_input, got {r2.intent}"
assert r2.slots.get("name") == "Jordan Rivera", "Must commit name slot"

print(json.dumps({"status": "ok", "committed_name": r2.slots.get("name")}))
`;

  const output = execSync("python", {
    cwd: projectRoot,
    input: pythonScript,
    encoding: "utf-8",
  });

  const parsed = JSON.parse(output.trim());
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.committed_name, "Jordan Rivera");
});
