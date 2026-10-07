# UBIX Architecture Governance: Naming Conventions

## 1. Domain-Aligned Naming Standard

Every identifier, file, and directory must reflect clear career-platform domain semantics.

### Pre-Creation Inspection:
Before naming a new file:
1. Inspect neighboring files in the target directory.
2. Inspect existing imports and domain terminology in `lib/career/`, `lib/memory/`, `lib/privacy/`, and `lib/automation/`.
3. Preserve the dominant convention.

## 2. File & Component Casing Conventions

| Scope | Casing Standard | Canonical Examples | Prohibited Anti-Patterns |
|---|---|---|---|
| **React Components** | `PascalCase.tsx` | `EvidenceWallet.tsx`, `JobIntelligenceModal.tsx`, `DailyPlanWidget.tsx` | `evidence_wallet.tsx`, `jobModal2.tsx`, `widget.tsx` |
| **Domain / Services** | `lowerCamelCase.ts` | `evidenceWallet.ts`, `gapExplainer.ts`, `careerMemory.ts`, `fieldMapping.ts` | `EvidenceWallet.ts`, `career2.ts`, `misc.ts`, `logic.ts` |
| **API Route Directories** | `kebab-case` or canonical resource path | `app/api/career/evidence/route.ts`, `app/api/privacy/export/route.ts` | `app/api/new_evidence/`, `app/api/api2/` |
| **Database Migrations** | `YYYYMMDD_descriptive_name.sql` | `20261007_ephemeral_stores_persistence.sql` | `migration_new.sql`, `schema2.sql` |

## 3. Ambiguity & Redundancy Ban

- **Forbidden Prefixes/Suffixes**: Do not append `New`, `Old`, `2`, `Temp`, `Final`, or `V2` to file names unless explicit versioning is documented.
- **Descriptive Names Only**: Names such as `data.ts`, `stuff.ts`, `misc.ts`, `helper.ts` are strictly forbidden. Use `requirementExtraction.ts`, `matchExplainer.ts`, `telemetryIdempotency.ts`.
