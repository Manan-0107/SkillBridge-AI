---
name: naming-review
description: >-
  Audits codebase naming conventions and flags ambiguous, duplicate, redundant,
  or anti-pattern names across UBIX. Use when reviewing code structure, organizing
  modules, or identifying technical debt. Does not rename files automatically.
---

# UBIX Naming Review Skill

Use this skill to audit file and module names across the UBIX repository.

## Audit Workflow

### 1. Scan for Ambiguous & Forbidden Patterns
Search for files matching forbidden naming patterns:
- Generic helpers: `*helper*.ts`, `*utils2*.ts`, `*common*.ts`, `*misc*.ts`
- Numbered duplicates: `*2.ts`, `*2.tsx`, `*V2*.ts`
- Ephemeral markers: `*temp*.ts`, `*test2*.ts`, `*scratch*.ts`
- Versioning artifacts: `*new*.ts`, `*old*.ts`, `*final*.ts`, `*backup*.ts`

### 2. Check Domain Alignment
Verify that file names reflect clear career-platform semantics (e.g. `evidenceWallet.ts`, `jobTrust.ts`, `gapExplainer.ts`, `telemetryIdempotency.ts`).

### 3. Check Casing Conventions
- React components: `PascalCase.tsx`
- Domain modules & services: `lowerCamelCase.ts`
- API routes: clear REST resource paths (`app/api/<resource>/route.ts`)

## Reporting Table Format

For every identified finding, provide:

| File Path | Current Name | Recommended Name | Reason | Risk Level |
|---|---|---|---|---|
| `[Path]` | `[Name]` | `[Domain-aligned Name]` | `[Why the change improves clarity]` | `[LOW / MEDIUM / HIGH]` |

> [!IMPORTANT]
> Do NOT automatically rename files during a naming review. File renames require explicit user consent and an accompanying import update plan.
