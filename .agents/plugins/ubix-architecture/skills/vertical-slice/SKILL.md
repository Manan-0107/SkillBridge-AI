---
name: vertical-slice
description: >-
  Executes the canonical 15-step UBIX vertical slice implementation workflow.
  Use when asked to implement or complete a product feature to ensure domain logic,
  persistence, API routes, UI components, accessibility, and browser verification are
  connected end-to-end without horizontal fragmentation or duplicate code.
---

# UBIX Vertical Slice Implementation Skill

This skill enforces the complete, end-to-end delivery of a UBIX feature from domain logic to browser-verified UI.

## The 15-Step Vertical Slice Workflow

### Step 1: Search the Repository
Before writing any code, search the codebase using `grep_search` and `file_search` for existing references to the feature or domain concepts.

### Step 2: Find Existing Domain Logic
Inspect `lib/` (specifically `lib/career/`, `lib/memory/`, `lib/privacy/`, `lib/automation/`, `lib/interview/`, `lib/jobs/`). Locate existing classes, functions, and interfaces. **Never rebuild existing logic.**

### Step 3: Find Existing Server API
Inspect `app/api/` for endpoints already mapped to the feature. Determine input/output schemas and authentication handling.

### Step 4: Find Existing Database Schema & Models
Inspect `supabase/migrations/` and `lib/db.ts`. Check if authoritative database tables and RLS policies already exist. If missing, create minimal migrations and typed helpers.

### Step 5: Find Existing UI Components
Inspect `components/` and `app/`. Identify whether partial, unlinked, or legacy components exist.

### Step 6: Identify Missing Links
Create a gap matrix:
`Domain Logic -> Persistence -> Server API -> UI Component -> Navigation Entry Point`

### Step 7: Implement Only the Missing Links
Write the minimal code required to bridge the gap. Do not refactor unrelated subsystems.

### Step 8: Connect UI → API → Domain → Persistence
Wire the React UI component to trigger the real server API endpoint, which calls the canonical domain library and authoritative database persistence.

### Step 9: Add Accessibility (WCAG 2.1 AA)
- Provide keyboard controls, visible focus rings, accessible labels.
- Add `aria-live="polite"` regions for asynchronous states.
- Ensure visual equivalents for deaf users and transcripts for audio.

### Step 10: Add Tests
Add unit tests in `test/` verifying the new wiring, input validations, and error handling.

### Step 11: Browser-Test (CDP / Chrome)
Verify in the actual browser:
- Page loads.
- Interactive controls trigger real requests.
- UI responds truthfully with loading, success, empty, or error states.

### Step 12: Reload-Test
Perform a hard page reload. Verify that persisted database records remain present and truthful.

### Step 13: Tenant-Isolation Test
Verify with two distinct authenticated user sessions that User A cannot read, mutate, or export User B's records.

### Step 14: Execute Quality Gates
Run:
```bash
npm run typecheck
npm run lint
node scripts/lint_design_tokens.mjs
npm test
npm run build
git diff --check
```

### Step 15: Report Exact Files Changed
Provide an explicit summary of:
- Modified files
- Created migrations
- Created API routes
- Created UI components
- Verification results across unit, browser, persistence, and isolation tests
