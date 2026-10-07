# UBIX Architecture Governance

Welcome to the UBIX repository. All engineering work, AI pair programming, and architectural changes within this repository are governed by the following strict architectural invariants.

---

## 1. Strict Layer Dependency Direction

```
UI (Components / Pages)
       ↓
API / Server Boundary (app/api/*)
       ↓
Domain & Application Logic (lib/*)
       ↓
Persistence & External Services (lib/db.ts, Supabase, Providers)
```

- **Domain modules (`lib/*`) must NEVER import React components, JSX, or browser-only hooks.**
- **UI components (`components/*`) must NEVER run raw database queries or embed raw business orchestration.**

---

## 2. Canonical Module Ownership & Anti-Duplication

- Every feature has exactly one canonical owner across `lib/`, `app/api/`, `lib/db.ts`, and `components/`.
- Search the repository before creating new files.
- Extend existing canonical modules rather than creating duplicate, shadow, or parallel implementations.
- Forbidden file names: `helper.ts`, `utils2.ts`, `temp.ts`, `test2.ts`, `service2.ts`, `newCareer.ts`, `final.ts`, `backup.ts`.

---

## 3. Definition of Done (Feature Completeness)

A feature is NOT complete merely because a library algorithm, API route, or database table exists.
A feature is COMPLETE only when all layers of the vertical slice are verified:
1. Domain logic in `lib/`
2. Supabase persistence where required
3. Server API route with Zod validation
4. Server-authenticated identity (never trust client-supplied userId)
5. Tenant isolation (User A cannot access User B data)
6. Interactive UI component with loading, empty, and error states
7. Discoverable user entry point / navigation route
8. WCAG 2.1 AA accessibility (keyboard, visible focus, screen reader `aria-live`, deaf-mode parity, reduced motion)
9. Real browser interaction verified
10. Page reload preserves persisted state
11. Unit tests, typecheck, lint, and production build pass

*If only the backend exists, report: **"Backend implemented; UI integration incomplete."***

---

## 4. Database & Persistence Discipline

- **Supabase PostgreSQL is authoritative.**
- Production code must **NEVER** silently fall back to in-memory Maps, module-level variables, localStorage, or process memory for user data.
- Development/test in-memory fallbacks must be explicitly environment-gated.
- All user-owned tables must have Row Level Security (RLS) enforcing `private.is_owner(user_id)`.
- Never expose the Supabase service-role key to browser bundles.

---

## 5. Security & Defensive Invariants

- Preserve existing cryptographically signed session tokens (`cf_session`), rate limits, file size/page limits, and navigation sanitizers.
- External job applications and destructive deletions require explicit user review and confirmation tokens.
- Audio synthesis must never vocalize passwords, tokens, or credentials.
- Change Protocol: `INSPECT → REVIEW → CHANGE → TEST`.

---

## 6. Accessibility (WCAG 2.1 AA)

- Blind users: Full keyboard traversal, visible focus, screen-reader labels, `aria-live` announcements.
- Deaf users: Zero sound-only information; visible badges, meters, and full transcripts.
- Voice: Strictly event-driven; no continuous microphone listeners. If microphone is silent, display truthful empty message: *"No audio was detected."* Never fabricate fallback answers.

---

## 7. Absolute Truthfulness

- Zero mock data or fabricated answers.
- Zero dummy button handlers (`onClick={() => {}}`).
- Algorithmic career projections must include clear scenario disclaimers (not salary/job guarantees).
