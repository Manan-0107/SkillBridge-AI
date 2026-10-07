# UBIX Architecture Governance: Module Ownership

## 1. Single Canonical Owner Principle

Every feature in UBIX must have exactly one designated canonical module owner across all layers of the stack.

Before modifying or implementing any capability, explicitly identify:
- **FEATURE NAME**
- **DOMAIN LOGIC (`lib/*`)**
- **SERVER API (`app/api/*`)**
- **DATABASE MODEL / TABLES**
- **UI COMPONENTS (`components/*`)**
- **USER ENTRY POINT / ROUTE (`app/*`)**
- **TEST SUITE (`test/*`)**

## 2. Canonical Ownership Registry

| Feature | Domain Logic | Server API | DB Tables / Models | Primary UI Component | User Entry Point |
|---|---|---|---|---|---|
| **Evidence Wallet** | `lib/career/evidenceWallet.ts` | `app/api/career/evidence/*` | `skill_evidence` | `EvidenceWallet.tsx` | `/roadmap?tab=evidence` |
| **Gap Explainer** | `lib/career/gapExplainer.ts` | `app/api/career/gaps` | Derived from evidence | `CareerGapExplainer.tsx` | `/roadmap?tab=gaps` |
| **Career Twin** | `lib/career/careerTwin.ts` | `app/api/career/twin/simulate` | `skill_evidence` | `CareerTwinWidget.tsx` | `/progress` |
| **Weekly Review** | `lib/career/weeklyReview.ts` | `app/api/career/weekly-review` | Multi-table telemetry | `WeeklyReviewWidget.tsx` | `/progress` |
| **Daily Plan & Recovery** | `lib/career/dailyPlan.ts`, `careerRecovery.ts` | `app/api/career/daily-plan` | Milestones & Executions | `DailyPlanWidget.tsx`, `CareerRecoveryBanner.tsx` | `/progress` |
| **Privacy Center & Memory**| `lib/memory/careerMemory.ts`, `lib/privacy/*` | `app/api/privacy/*` | `career_memory` | `SettingsView.tsx` | `/settings` |
| **Automation Center** | `lib/automation/engine.ts` | `app/api/automation` | `automation_executions` | `SettingsView.tsx` (Automations tab) | `/settings` |
| **UBIX Apply Review** | `lib/apply/ubixApply.ts`, `fieldMapping.ts` | `app/api/apply/*` | `applications` | `UbixApplyModal.tsx` | Job modal / Tracker |
| **Interview & Teach-Back**| `lib/interview/teachBack.ts`, `interviewEngine.ts` | `app/api/interviews` | `interviews` | `InterviewStudio.tsx` | `/jobs` & `/practice` |

## 3. Disallowed Practices

- Do NOT create alternate stores or shadow models for already-owned features.
- If an existing canonical module exists, any extension must be incorporated into that module.
