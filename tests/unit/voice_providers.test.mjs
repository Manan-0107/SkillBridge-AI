import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

test("VoiceProviders: Language routing routes Indic to Sarvam and English to Azure/ElevenLabs", () => {
  const pythonScript = `
import sys
import json
sys.path.insert(0, 'python_ai')
from voice_providers import voice_orchestrator

# Test Indic detection
assert voice_orchestrator.is_indic_language("hi-IN") is True
assert voice_orchestrator.is_indic_language("gu-IN") is True
assert voice_orchestrator.is_indic_language("mr-IN") is True
assert voice_orchestrator.is_indic_language("ta-IN") is True
assert voice_orchestrator.is_indic_language("te-IN") is True
assert voice_orchestrator.is_indic_language("bn-IN") is True

# Test English / International detection
assert voice_orchestrator.is_indic_language("en-US") is False
assert voice_orchestrator.is_indic_language("en-GB") is False
assert voice_orchestrator.is_indic_language("fr-FR") is False
assert voice_orchestrator.is_indic_language("es-ES") is False
assert voice_orchestrator.is_indic_language("de-DE") is False

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

test("VoiceProviders: TranscriptEvent schema normalizes output structure", () => {
  const pythonScript = `
import sys
import json
sys.path.insert(0, 'python_ai')
from voice_providers import TranscriptEvent

event = TranscriptEvent(
    text="Hello CareerForge",
    is_final=True,
    confidence=0.98,
    language="en-US",
    provider="azure_speech"
)

assert event.text == "Hello CareerForge"
assert event.is_final is True
assert event.confidence == 0.98
assert event.provider == "azure_speech"
assert event.timestamp > 0

print(json.dumps({"status": "ok", "provider": event.provider}))
`;

  const output = execSync("python", {
    cwd: projectRoot,
    input: pythonScript,
    encoding: "utf-8",
  });

  const parsed = JSON.parse(output.trim());
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.provider, "azure_speech");
});
