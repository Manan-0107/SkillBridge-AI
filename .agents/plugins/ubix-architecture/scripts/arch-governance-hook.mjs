// .agents/plugins/ubix-architecture/scripts/arch-governance-hook.mjs
// PreToolUse Hook: Non-destructive architecture governance safety inspection

import fs from "fs";

function readStdin() {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function run() {
  const inputRaw = readStdin();
  let payload = {};
  try {
    if (inputRaw) {
      payload = JSON.parse(inputRaw);
    }
  } catch {
    // If input parsing fails, always default to allow for safety
    console.log(JSON.stringify({ decision: "allow" }));
    return;
  }

  const toolCall = payload?.toolCall;
  const toolName = toolCall?.name;
  const args = toolCall?.args || {};
  const targetFile = args.TargetFile || args.FilePath || "";

  // Check forbidden naming patterns
  const forbiddenPatterns = [
    /helper\.(ts|tsx|js|mjs)$/i,
    /utils2\.(ts|tsx|js|mjs)$/i,
    /temp\.(ts|tsx|js|mjs)$/i,
    /test2\.(ts|tsx|js|mjs)$/i,
    /backup\.(ts|tsx|js|mjs)$/i,
    /final\.(ts|tsx|js|mjs)$/i,
    /scratch\.(ts|tsx|js|mjs)$/i,
  ];

  if (targetFile) {
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(targetFile)) {
        // Non-destructive advisory warning
        console.log(
          JSON.stringify({
            decision: "allow",
            reason: `UBIX Architecture Governance Notice: '${targetFile}' matches an ambiguous naming pattern. Consider using a domain-aligned name.`,
          })
        );
        return;
      }
    }
  }

  // Safe default: allow
  console.log(JSON.stringify({ decision: "allow" }));
}

run();
