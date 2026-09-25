import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const SCAN_DIRS = ["app", "components", "lib"];
const ALLOWED_FILES = new Set([
  path.normalize("app/globals.css"),
  path.normalize("app/api/jobs/alert/route.ts"),
]);

const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/g;
const FONT_SERIF_REGEX = /\bfont-serif\b/g;

let errors = [];

function scanFile(filePath, relativePath) {
  if (ALLOWED_FILES.has(path.normalize(relativePath))) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    // Ignore markdown headings (e.g. ### Title) or comments that contain #
    // Regex matches valid hex colors like #fff, #ffffff, #123456
    const hexMatches = line.match(HEX_REGEX);
    if (hexMatches) {
      hexMatches.forEach((match) => {
        errors.push({
          file: relativePath,
          line: idx + 1,
          type: "Stray Hex Code",
          match,
          snippet: line.trim(),
        });
      });
    }

    const serifMatches = line.match(FONT_SERIF_REGEX);
    if (serifMatches) {
      errors.push({
        file: relativePath,
        line: idx + 1,
        type: "Prohibited font-serif",
        match: "font-serif",
        snippet: line.trim(),
      });
    }
  });
}

function walkDir(dirPath, relativeRoot = "") {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativeRoot, entry.name);

    if (entry.isDirectory()) {
      walkDir(fullPath, relPath);
    } else if (entry.isFile() && /\.(tsx?|jsx?|css)$/.test(entry.name)) {
      scanFile(fullPath, relPath);
    }
  }
}

for (const dir of SCAN_DIRS) {
  walkDir(path.join(projectRoot, dir), dir);
}

if (errors.length > 0) {
  console.error("❌ Design Token & Typography Lint Failures Found:\n");
  errors.forEach((err) => {
    console.error(
      `  - [${err.type}] ${err.file}:${err.line} -> Found '${err.match}' in:\n      ${err.snippet}`
    );
  });
  console.error(
    `\nTotal Violations: ${errors.length}. All colors and fonts must use tokens from tailwind.config.ts.\n`
  );
  process.exit(1);
} else {
  console.log("✅ Design Tokens & Typography Lint Passed! Zero stray hex codes or font-serif found.");
  process.exit(0);
}
