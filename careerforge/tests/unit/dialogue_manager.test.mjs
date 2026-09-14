import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

test("DialogueManager: Incomplete input triggers follow-up loop and slot filling", () => {
  const pythonScript = `
import sys
import json
sys.path.insert(0, 'python_ai')
from dialogue_manager import dialogue_manager

sess_id = "test_sess_followup"

# Step 1: Incomplete utterance
r1 = dialogue_manager.process_utterance(sess_id, "update my profile")
assert r1.intent == "incomplete_needs_followup", f"Expected incomplete_needs_followup, got {r1.intent}"
assert r1.requires_followup is True, "Expected requires_followup to be True"
assert r1.expected_slot == "profile_field_choice"

# Step 2: Answer which field
r2 = dialogue_manager.process_utterance(sess_id, "my name")
assert r2.intent == "form_input"
assert r2.requires_followup is True
assert r2.expected_slot == "name"

# Step 3: Provide name slot
r3 = dialogue_manager.process_utterance(sess_id, "Alex Rivera")
assert r3.intent == "form_input"
assert r3.requires_followup is False
assert r3.slots.get("name") == "Alex Rivera"

print(json.dumps({"status": "ok", "final_name": r3.slots.get("name")}))
`;

  const output = execSync("python", {
    cwd: projectRoot,
    input: pythonScript,
    encoding: "utf-8",
  });

  const parsed = JSON.parse(output.trim());
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.final_name, "Alex Rivera");
});

test("DialogueManager: Roadmap queries and actions resolve accurately", () => {
  const pythonScript = `
import sys
import json
sys.path.insert(0, 'python_ai')
from dialogue_manager import dialogue_manager

sess_id = "test_sess_roadmap"

# Query next step
r1 = dialogue_manager.process_utterance(sess_id, "what is next on my roadmap")
assert r1.intent == "roadmap_query", f"Expected roadmap_query, got {r1.intent}"
assert "Modern CSS" in r1.reply_text

# Mark complete action
r2 = dialogue_manager.process_utterance(sess_id, "mark HTML Semantics complete")
assert r2.intent == "roadmap_action", f"Expected roadmap_action, got {r2.intent}"
assert r2.action == "mark_complete"
assert "html semantics" in r2.target.lower()

# Incomplete mark complete triggers follow-up
r3 = dialogue_manager.process_utterance(sess_id, "mark complete")
assert r3.intent == "incomplete_needs_followup"
assert r3.requires_followup is True

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

test("DialogueManager: Navigation intents resolve track targets", () => {
  const pythonScript = `
import sys
import json
sys.path.insert(0, 'python_ai')
from dialogue_manager import dialogue_manager

sess_id = "test_sess_nav"

r1 = dialogue_manager.process_utterance(sess_id, "go to frontend roadmap")
assert r1.intent == "navigation"
assert r1.target == "roadmap/frontend"

r2 = dialogue_manager.process_utterance(sess_id, "open practice hub")
assert r2.intent == "navigation"
assert r2.target == "practice"

r3 = dialogue_manager.process_utterance(sess_id, "open resume analyzer")
assert r3.intent == "navigation"
assert r3.target == "resume"

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
