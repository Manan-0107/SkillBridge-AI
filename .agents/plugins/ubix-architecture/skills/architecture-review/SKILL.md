---
name: architecture-review
description: >-
  Performs a pre-change architectural inspection across UBIX subsystems.
  Use before initiating non-trivial changes, new feature integrations, or module refactors
  to map dependencies, verify canonical ownership, assess security/database/accessibility impact,
  and generate an actionable change plan without premature code edits.
---

# UBIX Pre-Change Architecture Review Skill

Use this skill before modifying or adding features across the UBIX codebase.

## The 10-Step Architecture Review Methodology

### Step 1: Map Affected Modules
Identify all files that will be touched or referenced across `app/`, `components/`, `lib/`, and `supabase/migrations/`.

### Step 2: Identify Canonical Owners
Determine the single canonical module owner for the feature. If an owner exists, verify that no duplicate or parallel module is introduced.

### Step 3: Inspect Dependency Direction
Verify that the proposed changes strictly maintain:
`UI -> API -> Domain Logic -> Persistence`
Ensure domain modules never import UI components.

### Step 4: Assess Database & Persistence Impact
- Will schema migrations be required?
- Are tables protected by strict Row Level Security (RLS)?
- Is production state persisted in Supabase rather than in-memory Maps?

### Step 5: Assess Server API Impact
- Does the endpoint authenticate via server-side session tokens?
- Are tenant boundaries enforced against IDOR attacks?
- Are input payloads validated with Zod/schemas?

### Step 6: Assess UI Impact
- Does the UI correspond to real backend capabilities?
- Are loading, empty, and error states defined?
- Are dummy button handlers (`onClick={() => {}}`) strictly avoided?

### Step 7: Assess Accessibility Impact
- Can a blind user navigate and operate this via keyboard and screen reader?
- Can a deaf user perceive all information without audio?
- Are live regions configured for dynamic asynchronous updates?

### Step 8: Assess Security Impact
- Are existing rate limiters, session validators, or CSRF guards impacted?
- Is the service-role key protected from client exposure?
- Are passwords/secrets excluded from logs and voice synthesis?

### Step 9: Check for Duplicate Implementations
Search for similar function names, types, or utilities elsewhere in `lib/`. Favor extension over duplication.

### Step 10: Produce a Change Plan
Compile a structured architectural change plan specifying:
1. Canonical files to modify
2. New files (if strictly necessary)
3. Database migrations required
4. Risks and mitigations
5. Verification criteria
