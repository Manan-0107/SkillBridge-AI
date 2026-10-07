# UBIX Architecture Governance: Feature Completeness

## 1. Definition of Done (The 19-Point Invariant)

A feature is **NEVER** considered implemented merely because:
- a TypeScript file exists
- a function or algorithm exists
- an API route exists
- unit tests pass
- a database schema is drafted

A feature is **COMPLETE** if and only if all 19 criteria are verified:

1. [ ] **Domain logic** exists in `lib/`.
2. [ ] **Authoritative persistence** exists in Supabase/database where state is retained.
3. [ ] **Server API** exists with strict input validation.
4. [ ] **Server-authenticated identity** is derived from session (`cf_session`), never trusting client inputs.
5. [ ] **Tenant isolation** is strictly enforced (User A cannot access or mutate User B data).
6. [ ] **Interactive UI** exists in `components/`.
7. [ ] **Discoverable entry point** exists in navigation/pages.
8. [ ] **Loading states** are rendered with accessible status announcements.
9. [ ] **Empty states** are truthful (e.g. "No evidence added yet" rather than fake demo data).
10. [ ] **Error states** provide actionable, accessible recovery paths.
11. [ ] **Accessibility (WCAG 2.1 AA)**: full keyboard support, visible focus, screen reader announcements.
12. [ ] **Browser interaction**: buttons, modals, forms execute actual mutations.
13. [ ] **Reload behavior**: page refresh preserves the intended state without regressions.
14. [ ] **Persistence durability**: state survives process restarts.
15. [ ] **Security boundaries**: RLS, CSRF, rate limiting, and permission policies verified.
16. [ ] **Unit and integration tests** pass (`npm test`).
17. [ ] **Typecheck** passes cleanly (`npm run typecheck`).
18. [ ] **Lint** passes cleanly (`npm run lint` and design token lint).
19. [ ] **Production build** compiles successfully (`npm run build`).

## 2. Mandatory Reporting Vocabulary

When communicating the status of work:
- If only the library/backend is present:
  > **"Backend implemented; UI integration incomplete."**
- If UI is mocked or lacks real persistence:
  > **"UI prototype present; persistence/API disconnected."**
- Use **"VERIFIED"** only when all 19 criteria have been validated in the browser.
