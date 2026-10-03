import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

test("DynamicQuestionOrchestrator: All 12 dynamic architectural scenarios pass", () => {
  const runnerPath = path.join(projectRoot, "tests/unit/run_dynamic_scenarios.ts");
  const output = execSync(`npx --yes tsx "${runnerPath}"`, {
    cwd: projectRoot,
    encoding: "utf-8",
  });

  const parsed = JSON.parse(output.trim());
  assert.equal(parsed.status, "ok", "Scenarios execution must succeed");

  const results = parsed.results;
  assert.equal(results["Scenario 1: Profile-Driven Dynamic Questions"], true);
  assert.equal(results["Scenario 2: Memory & Non-Repetition"], true);
  assert.equal(results["Scenario 3: Multi-Field Single-Utterance Extraction"], true);
  assert.equal(results["Scenario 4: Conversational Task-Switching"], true);
  assert.equal(results["Scenario 5: Dynamic Ambiguity Clarification"], true);
  assert.equal(results["Scenario 6: Natural Hindi Response"], true);
  assert.equal(results["Scenario 7: Natural Gujarati Response"], true);
  assert.equal(results["Scenario 8: Multilingual Code-Switching"], true);
  assert.equal(results["Scenario 9: Adaptive Weakness Probing"], true);
  assert.equal(results["Scenario 10: Graceful Requirement Skip"], true);
  assert.equal(results["Scenario 11: Uncertain Knowledge Handling"], true);
  assert.equal(results["Scenario 12: Immediate Task Redirect"], true);
  assert.equal(results["Adaptive Assessment: Dynamic Difficulty & Flow"], true);
});
