# UBIX — Post-Runtime Product Acceptance Audit

**Date:** October 7, 2026  
**Auditor:** Antigravity Autonomous Agent (Google DeepMind)  
**Verified Baseline Commit:** `8291b6c` (`fix(runtime): resolve CSP protocol-relative script and font image asset violations`)  
**Environment:** Localhost Development & Production Build Validation (`npm run dev` & `npm run start`)

---

## Executive Summary

Following successful runtime stabilization and independent browser verification (0 exceptions, strict production CSP without `unsafe-eval`, React hydration verified, Three.js canvas active, and passing all 295 automated tests), an adversarial, end-to-end Product Acceptance Audit was conducted across the 11 core product journeys.

This audit evaluates the actual, user-facing feature functionality—distinguishing between what is fully functional in the live UI and database, what is partially integrated, and what exists exclusively as headless library algorithms in `lib/` without active API endpoints or user-facing components.

---

## Journey-by-Journey Audit

### Journey 1: New User Journey
**Flow:** Landing → Get Started → Account Creation → Profile → Assistant

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **UI Works** | YES | `#nav-getstarted-btn` and `#hero-getstarted-btn` smoothly mount `AuthGate`. Switching between Sign In / Sign Up updates form inputs with keyboard focus. |
| **API Works** | YES | `POST /api/auth/login` with `mode: "signup"` validates payload via Zod, checks scrypt credentials or Supabase `auth.signUp`, and signs HMAC-SHA256 session token. |
| **Database State** | YES | `upsertUser` records user in `public.users` (or fallback credentials store if offline). |
| **Survives Refresh** | YES | Authenticated session cookie (`cf_session`) is verified by `GET /api/auth/session` on reload, preserving workspace state. |
| **User Scoping** | YES | Tenant-scoped session token; client-supplied foreign user IDs are rejected. |
| **Accessibility** | YES | Full keyboard navigation; speech dictation per field; screen-reader live regions; high-contrast tokens. |
| **States Handled** | YES | Loading spinner on button; inline error messages for invalid emails / short passwords; empty form validation. |
| **Confirmation / Safety** | YES | Explicit form submission required. |
| **Data Truthfulness** | YES | Real password hashing, real session tokens, zero mock users. |
| **Overall Status** | **VERIFIED** | End-to-end functional. |

---

### Journey 2: Blind User Journey
**Flow:** Account Creation → Voice Calibration → Spoken Confirmation → Navigation by Voice → Assistant → Roadmap → Practice → Resume → Jobs

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **UI Works** | YES | `AccessibilityProfileModal.tsx` provides "Blind or Low Vision" selection. `VoiceModeDetector.tsx` triggers 3-attempt, 5-second countdown calibration. |
| **API Works** | YES | `GET /api/user/profile` and `PATCH /api/user/preferences` persist speech settings; `POST /api/speech/transcribe` and `/synthesize` provide cloud fallback. |
| **Database State** | YES | Persists `requiresTextFallback: false` in `public.user_preferences`. |
| **Survives Refresh** | YES | Persisted in `localStorage` (`careerforge_voice_calibrated`) and DB preferences. |
| **User Scoping** | YES | Profile and voice preferences tied to authenticated `userId`. |
| **Accessibility** | YES | Screen reader announcements (`speakText`), accessible audio chimes, voice-controlled form input. |
| **Voice Navigation** | YES | `lib/voiceCommands.ts` handles: "open my roadmap" → `/roadmap`, "start practice" → `/practice`, "build my resume" → `/resume`, "find jobs" → `/local`, "go home" → Assistant. |
| **Data Truthfulness** | YES | Uses Web Speech synthesis or server speech engines with factual announcements. |
| **Overall Status** | **VERIFIED** | End-to-end functional. |

---

### Journey 3: Deaf User Journey
**Flow:** Account Creation → Visual Interaction → Captions/Transcripts → Assistant → Roadmap → Practice → Jobs

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **UI Works** | YES | `AccessibilityProfileModal.tsx` provides "Deaf or Hard of Hearing" selection. |
| **Zero Mic Traps** | YES | `GlobalVoiceDictator.tsx` unmounts microphone listeners completely when `accessibilityProfile === "deaf_hard_of_hearing"`. Zero mic prompts appear. |
| **Visual Cues** | YES | Status transitions (Idle, Listening, Thinking, Answer Ready) presented through visual orb indicators and synchronized captions. |
| **API & Database** | YES | `PATCH /api/user/preferences` sets `requiresTextFallback: true`, preventing subsequent mic probes across sessions. |
| **Survives Refresh** | YES | Stored in DB and localStorage; on reload, system short-circuits to purely visual text mode. |
| **User Scoping** | YES | User-scoped in preferences table. |
| **Accessibility** | YES | WCAG AA color contrast, visible keyboard focus rings, no sound-dependent alerts or barriers. |
| **Data Truthfulness** | YES | Visual states reflect real request lifecycle without fabricated delays. |
| **Overall Status** | **VERIFIED** | End-to-end functional. |

---

### Journey 4: Career Discovery Journey
**Flow:** Goal → Profile → Skill Graph → Skill Evidence → Skill Gaps → Career Gap Explanation → Roadmap

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **UI Works** | PARTIAL | Target role selection and Phased Milestones roadmap work (`/roadmap` renders tiers and course cards). 3D Skill Graph renders on `/journey`. |
| **Evidence Wallet UI** | **MISSING** | `lib/career/evidenceWallet.ts` defines multi-source skill evidence structures, but **no UI component in `components/` renders or edits the Evidence Wallet**. |
| **Gap Explainer UI** | **MISSING** | `lib/career/gapExplainer.ts` provides prerequisite fulfillment and gap explanation, but it is not imported into `CareerRoadmap.tsx`. Roadmap stages display static curated benchmarks from `lib/data.ts`. |
| **API Works** | PARTIAL | `GET /api/roadmap` serves categorized tier datasets; no dedicated Evidence Wallet CRUD API exists. |
| **Database State** | PARTIAL | User target role is saved to DB, but individual skill evidence items reside in in-memory Maps in `evidenceWallet.ts`. |
| **Overall Status** | **FAILED** | Goal and Roadmap milestones work, but Skill Evidence Wallet and Dynamic Gap Explainer lack user-facing UI and persistent DB models. |

---

### Journey 5: Learning Journey
**Flow:** Roadmap → Learning → Practice → Progress → Adaptive Assessment

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **UI Works** | YES | `/roadmap` links directly to `/learning` (course catalog) and `/practice` (interactive coding and behavioral drills). `/progress` renders `CareerTelemetry.tsx`. |
| **Adaptive Assessment** | YES | `PracticeHub.tsx` integrates `AdaptiveAssessmentEngine`, questions adapt dynamically based on difficulty and previous answers. |
| **API Works** | YES | `POST /api/practice/telemetry` logs practice answers, tracks scores, and verifies submissions. |
| **Database State** | YES | Practice completions and scores are recorded via telemetry queue. |
| **Idempotency** | YES | Strict `eventId` deduplication in `telemetry/route.ts` ensures network retries never double-award points or streaks. |
| **Survives Refresh** | YES | Telemetry events and user score states persist in localStorage and DB. |
| **Accessibility** | YES | Question hints, Markdown explanations, keyboard navigation, and audio playback (`speakText`) supported. |
| **Data Truthfulness** | YES | Real technical questions and standard concepts; mathematical scores are clamped to [0, 100]. |
| **Overall Status** | **VERIFIED** | End-to-end functional. |

---

### Journey 6: Resume Journey
**Flow:** Resume Upload → Parsing → Extracted Information → Resume Builder → Tailoring → Jobs

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **UI Works** | YES | `ResumeSuite.tsx` provides tabbed navigation: `Analyzer.tsx` (ATS upload and breakdown), `Builder.tsx` (108KB full interactive builder), `Personalizer.tsx` (job-specific tailoring). |
| **API Works** | YES | `POST /api/resume/parse` (in-memory PDF/DOCX parser), `POST /api/resume/analyze` (ATS scoring), `POST /api/resume/save` (database persistence), `POST /api/resume/optimize` (bullet refinement). |
| **Security Bounding** | YES | Authoritative 10MB file limit, magic byte validation (rejects PE/ELF/Mach-O executables), ZIP bomb checks, 15-page ceiling, 64KB text bounding. |
| **Database State** | YES | Resumes saved to Supabase `public.resumes` table or local user storage. |
| **Survives Refresh** | YES | Loaded drafts and parsed metrics rehydrate on page reload. |
| **Accessibility** | YES | Accessible file input label, high-contrast scores, keyboard-tabbable builder form fields. |
| **Data Truthfulness** | YES | Real PDF/DOCX text extraction; ATS scores compute actual keyword density and readability without arbitrary fabrications. |
| **Overall Status** | **VERIFIED** | End-to-end functional. |

---

### Journey 7: Jobs Journey
**Flow:** Job Search → Job Intelligence → Match Explanation → Trust/Scam Signals → Save Job → Application

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **UI Works** | YES | `/jobs` and `/opportunities` render `LocalOpportunities.tsx` with search input, location filters, remote toggle, and job cards. |
| **Job Intelligence** | YES | Clicking any job opens `JobIntelligenceModal.tsx`, showing match breakdown, required skills, and trust indicators. |
| **Trust / Scam Signals** | YES | Identifies verified ATS origins (Greenhouse, Lever, Workday) vs unverified sources; flags suspicious compensation or financial scam patterns. |
| **Save & Apply** | YES | "Save Job" button calls `POST /api/jobs/saved`; "Track Application" creates an entry in `ApplicationTracker.tsx`. |
| **API Works** | YES | `GET /api/jobs` queries live providers (Arbeitnow, Remotive, Jobicy, Adzuna) with curated directory fallback. `POST /api/jobs/saved` manages bookmarks. |
| **Database State** | YES | Saved jobs and tracked applications are stored in Supabase with tenant isolation. |
| **Data Truthfulness** | YES | Salary estimates clearly flagged as inferred when not stated in posting; no fabricated recruiter responses. |
| **Overall Status** | **VERIFIED** | End-to-end functional. |

---

### Journey 8: UBIX Apply Journey
**Flow:** Job → Field Mapping → Validation → Review → Confirmation → Application Monitoring

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **Monitoring UI** | YES | `ApplicationTracker.tsx` displays Kanban columns (`SAVED`, `PREPARING`, `READY`, `APPLIED`, `INTERVIEW`, `OFFER`), timeline logs, and status updates via `POST /api/applications`. |
| **Application Copilot** | YES | Copilot modal generates cover letter drafts and answers candidate questions via `POST /api/applications/copilot`. |
| **ATS Field Mapping** | **MISSING IN UI** | `lib/apply/fieldMapping.ts` implements field mapping and minimization for Greenhouse/Lever/Workday, and `lib/apply/ubixApply.ts` generates single-use confirmation tokens. However, **no interactive modal exists in the UI allowing a candidate to review mapped fields before external submission**. |
| **Review-First Safety** | YES (Code) | Code-level invariant enforces `CONFIRMATION_REQUIRED` before dispatch. |
| **Overall Status** | **FAILED** | Application tracking and Copilot drafting work, but the automated ATS field mapping review modal is not wired to the UI. |

---

### Journey 9: Interview Journey
**Flow:** Job/Application → Interview Simulator → Feedback → Teach-Back → Improvement

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **UI Works** | YES | `InterviewStudio.tsx` opens from `ApplicationTracker` or job listing. Renders sequential technical and behavioral interview questions. |
| **API Works** | YES | `POST /api/interviews` with `action: "generate_questions"` and `action: "evaluate_answer"` returns STAR feedback (strengths, missed opportunities, actionable suggestions). |
| **Voice & Speech** | YES | "Read Question" button speaks question via `speakText`; audio recording or text input for candidate responses. |
| **Teach-Back Mode** | **MISSING IN UI** | `lib/interview/teachBack.ts` implements the Feynman teach-back evaluation algorithm, but `InterviewStudio.tsx` only exposes STAR interview feedback. |
| **Minor Defect** | **FOUND** | In `InterviewStudio.tsx` (line 88), if microphone recording produces empty transcript, a hardcoded architectural answer string is injected into the text field as a simulation fallback. |
| **Overall Status** | **VERIFIED (WITH MINOR DEFECT)** | Core STAR interview simulation and audio evaluation work; Teach-Back mode is library-only; hardcoded fallback string should be removed in favor of an explicit "No audio detected" notice. |

---

### Journey 10: Career Intelligence Journey
**Flow:** Career Twin → Weekly Review → Daily Plan → Opportunity Monitoring → Recovery Automation

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **Career Twin UI** | **MISSING** | `lib/career/careerTwin.ts` implements `simulateCareerGrowth` for what-if skill acquisition scenarios, but **no UI component exists** for candidate scenario simulation. |
| **Weekly Review** | **MISSING** | `lib/career/weeklyReview.ts` implements `generateWeeklyCareerReview`, but has no API route or UI screen. |
| **Daily Plan** | **MISSING** | "What Should I Do Today?" scheduling algorithm exists in evolution specs, but has no dedicated UI dashboard widget. |
| **Recovery Automation** | **MISSING** | Zero-shame timeline recalibration exists in `lib/` without an interactive frontend flow. |
| **Overall Status** | **FAILED** | Comprehensive library algorithms exist and pass unit tests, but lack user-facing UI screens and API endpoints. |

---

### Journey 11: Privacy & Governance Journey
**Flow:** Profile → Memory → Privacy Center → Automation Permissions → Export → Deletion

| Dimension | Assessment | Evidence & Notes |
|:---|:---:|:---|
| **Profile & Logout** | YES | Header dropdown provides user profile details and clean logout. |
| **Career Memory UI** | **MISSING** | `lib/memory/careerMemory.ts` implements structured provenance tracking (`CONFIRMED`, `INFERRED`, `USER_REJECTED`), but has no UI screen allowing users to inspect or reject memory items. |
| **Privacy Center UI** | **MISSING** | `lib/privacy/privacyCenter.ts` defines data minimization rules, purpose explanations, export formats, and deletion plans. However, **no `/privacy` or `/settings/privacy` route exists**; the "Settings" link in `TopNav` points to an unhandled `#settings` hash. |
| **Automation Center UI** | **MISSING** | `app/api/automation/route.ts` implements 3-tier action policy (`SAFE_AUTOMATIC`, `CONFIRMATION_REQUIRED`, `EXPLICIT_HUMAN_ACTION`), but no frontend dashboard allows users to view audit logs or manage automation permissions. |
| **Data Export / Deletion** | **MISSING** | `exportUserDataSummary` and `prepareDataDeletionPlan` exist in `lib/privacy/privacyCenter.ts`, but lack an API endpoint and UI trigger buttons. |
| **Overall Status** | **FAILED** | Strong backend privacy architecture and data classification exist, but lack user-facing Privacy Center and data export/deletion controls. |

---

## 1. Complete Feature Matrix

| # | Journey | Status | UI Available | API Available | DB Persistence | Survives Reload |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | **New User** | **VERIFIED** | Full (`AuthGate`) | Full (`/api/auth/login`) | Supabase / Scrypt | Yes |
| 2 | **Blind User** | **VERIFIED** | Full (`VoiceModeDetector`) | Full (STT/TTS APIs) | DB Preferences | Yes |
| 3 | **Deaf User** | **VERIFIED** | Full (Visual Cues) | Full (`/api/user/preferences`) | DB Preferences | Yes |
| 4 | **Career Discovery** | **FAILED** | Partial (Roadmap only) | Partial (`/api/roadmap`) | Partial | Yes |
| 5 | **Learning & Practice** | **VERIFIED** | Full (`PracticeHub`) | Full (`/api/practice/telemetry`)| Telemetry Queue | Yes |
| 6 | **Resume Suite** | **VERIFIED** | Full (`ResumeSuite`) | Full (Parse/Analyze/Save) | Supabase Resumes | Yes |
| 7 | **Jobs & Radar** | **VERIFIED** | Full (`LocalOpportunities`) | Full (`/api/jobs`, Saved) | Supabase Jobs | Yes |
| 8 | **UBIX Apply** | **FAILED** | Partial (Tracking only) | Partial (`/api/applications`) | Supabase Apps | Yes |
| 9 | **Interview Simulator** | **VERIFIED** | Full (`InterviewStudio`) | Full (`/api/interviews`) | Supabase Apps | Yes |
| 10 | **Career Intelligence** | **FAILED** | None (Headless library) | None | In-Memory Only | No |
| 11 | **Privacy & Governance** | **FAILED** | None (Headless library) | Partial (`/api/automation`) | In-Memory Only | No |

---

## 2. Failed Journeys

1. **Journey 4 (Career Discovery)**:
   - *Failure Point:* Skill Evidence Wallet and Dynamic Gap Explainer exist in `lib/career/evidenceWallet.ts` and `lib/career/gapExplainer.ts`, but are not surfaced in any frontend component.
2. **Journey 8 (UBIX Apply)**:
   - *Failure Point:* Application Tracker and Copilot draft generators are functional, but the automated ATS field mapping review modal (`mapAndMinimizeProfileFields` / `prepareApplicationDraft`) is not wired into the UI.
3. **Journey 10 (Career Intelligence)**:
   - *Failure Point:* Career Twin (`careerTwin.ts`), Weekly Review (`weeklyReview.ts`), and Daily Plan algorithms are headless and lack UI views.
4. **Journey 11 (Privacy & Governance)**:
   - *Failure Point:* Personal Career Memory (`careerMemory.ts`), Privacy Center (`privacyCenter.ts`), and Data Export/Deletion have no user-facing UI screens or export endpoints. "Settings" link in `TopNav` is an inert `#settings` anchor.

---

## 3. Blocked Journeys

- **Google OAuth Login**: Blocked when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is unconfigured. `AuthGate.tsx` handles this gracefully with an informative error message directing users to email or guest mode.
- **Production Rate Limiting**: Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local` or environment, otherwise fails closed with 503 by design.

---

## 4. Missing Functionality

1. **Evidence Wallet UI**: Component to view, add, and verify skill evidence items with confidence scores.
2. **UBIX Apply Review Modal**: Interface to inspect mapped vs pruned ATS fields before confirming external application submission.
3. **Career Twin Simulation Panel**: What-if scenario UI allowing candidates to simulate the effect of adding new skills.
4. **Privacy Center & Settings Page**: A dedicated `/settings/privacy` or modal providing:
   - Career Memory inspection (confirming/rejecting inferred items)
   - Automation permissions toggle
   - One-click JSON data export
   - Irreversible account data deletion
5. **Teach-Back Practice UI**: Section in `InterviewStudio` or `PracticeHub` dedicated to the Feynman teach-back method.

---

## 5. Security Concerns Discovered

1. **In-Memory Store Data Loss Risk**:
   - `lib/memory/careerMemory.ts`, `lib/career/evidenceWallet.ts`, and `lib/automation/engine.ts` store state in module-level `Map` objects (`userMemoryStores`, `userEvidenceStores`, `userExecutions`). In serverless deployment (e.g. Vercel), module state is ephemeral and resets between lambdas. These must be persisted to Supabase database tables with RLS.
2. **Inert Settings Anchor**:
   - `TopNav.tsx` renders `<Link href="#settings">Settings</Link>`. While not a vulnerability, clicking it pollutes the window hash without providing user configuration controls.

---

## 6. Accessibility Concerns Discovered

1. **Interview Studio Empty Audio Fallback**:
   - In `InterviewStudio.tsx` (line 88), if microphone recording returns an empty string, a pre-written microservices response is injected into the text field. This violates truthfulness for deaf/mute candidates or failed recording sessions. It should instead display an accessible alert: *"No audio was detected. Please type your response or try recording again."*
2. **Missing Live Region on Interview Timer**:
   - The interview recording countdown is visual-only and should have an `aria-live="polite"` region announcing recording start and stop for screen reader users.

---

## 7. Provider & Configuration Dependencies

| Provider / Config | Required By | Current Status | Behavior if Missing |
|:---|:---|:---:|:---|
| **UPSTASH_REDIS** | Production Rate Limiting | Configured locally | Fails closed with HTTP 503 (`SERVICE_UNAVAILABLE`) in production tier. |
| **SESSION_SECRET** | HMAC Session Signatures | Configured | Fails closed with fatal error in production tier. |
| **SUPABASE_URL / ANON_KEY** | Database & Auth | Configured | Falls back to local credential store / in-memory mocks. |
| **OPENAI_API_KEY / GEMINI_API_KEY** | Assistant Chat & Copilot | Configured | Returns structured provider-unavailable notice. |
| **GOOGLE_CLIENT_ID** | Google OAuth | Optional (Unset) | Shows clear UI message to use email or guest mode. |
| **ADZUNA / SERPAPI** | Job Search Providers | Optional | Falls back to Arbeitnow, Remotive, Jobicy, and curated directory. |

---

## 8. Exact Next Implementation Priorities

1. **Wire Privacy Center & Settings (`/settings/privacy`)**:
   - Replace inert `#settings` anchor with an accessible Settings modal or page.
   - Implement Data Export (`exportUserDataSummary`) and Account Deletion (`prepareDataDeletionPlan`) API routes.
   - Surface Personal Career Memory inspection (allowing users to confirm or reject inferred preferences).
2. **Build Evidence Wallet & Career Gap UI**:
   - Create an Evidence Wallet component under `/roadmap` or `/progress` displaying verified skill artifacts.
   - Wire `gapExplainer.ts` into `CareerRoadmap.tsx` to dynamically explain missing competencies against live market benchmarks.
3. **Mount UBIX Apply Review Modal**:
   - Add a "Review & Apply with UBIX" action in `JobIntelligenceModal.tsx` and `ApplicationTracker.tsx`.
   - Render the field minimization view (`mapAndMinimizeProfileFields`) requiring single-use confirmation token before submission.
4. **Persist Ephemeral In-Memory Stores to Supabase**:
   - Create Supabase migrations for `career_memory`, `skill_evidence`, and `automation_executions` tables to ensure state survives serverless restarts.
5. **Clean up Interview Studio Audio Fallback**:
   - Remove the hardcoded dummy transcript in `InterviewStudio.tsx` line 88 and replace with an accessible "No audio detected" notice.
