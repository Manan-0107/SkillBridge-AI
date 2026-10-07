# UBIX Architecture Governance: Database & Persistence Discipline

## 1. Authoritative Production Persistence

Supabase PostgreSQL is the authoritative persistence tier for all user-owned data in UBIX.

### Strict Persistence Invariants:
1. **No Ephemeral Production Fallbacks**: Production code must **NEVER** silently fall back to in-memory Maps, module-level variables, localStorage, or process memory for user data.
2. **Environment-Gated Test Stubs**: In-memory stores or mock fallbacks are permitted **ONLY** in explicit local development or unit test environments (`process.env.NODE_ENV === "test"` or when DB is intentionally unconfigured locally). If a database call fails in production, it must fail closed and report an explicit error.
3. **Fail-Closed Reliability**: If database operations fail, do not pretend state was saved or silently continue with lost data.

## 2. Row Level Security (RLS) & Multi-Tenant Isolation

1. **Every User Table Must Have RLS**: All tables containing user data (`career_memory`, `skill_evidence`, `automation_executions`, `applications`, `resumes`, etc.) must have Row Level Security enabled.
2. **Explicit Owner Policies**: RLS policies must use `private.is_owner(user_id)` or `auth.uid() = user_id`. Never write permissive bypass policies such as `USING (true)`.
3. **No Service-Role Browser Exposure**: The Supabase service-role key must **NEVER** be referenced in client components, browser bundles, or public headers.

## 3. Server-Authoritative Identity

1. **Never Trust Client-Supplied User IDs**: Server endpoints must derive the user identity directly from the cryptographically validated HMAC session token (`getAuthenticatedUserId(req)`).
2. **No Client Authorization Claims**: The server ignores client-supplied timestamps, ownership IDs, or privilege claims.
