# UBIX Architecture Governance: Dependency Boundaries & Module Structure

## 1. Strict Dependency Direction

All code in UBIX must strictly adhere to this unidirectional layer flow:

```
UI (Components / Pages)
       ↓
API / Server Boundary (app/api/*)
       ↓
Domain & Application Logic (lib/*)
       ↓
Persistence & External Services (lib/db.ts, Supabase, Providers)
```

### Prohibited Directions:
1. **No Inverted Imports**: Domain and business logic (`lib/*`) must **NEVER** import React components, JSX elements, or UI hooks.
2. **No Direct Persistence in UI**: React components must **NEVER** perform raw database queries, bypass API routes, or embed heavy business orchestration. UI communicates through server APIs or canonical client state hooks.
3. **No Circular Dependencies**: Circular dependencies between domain modules are strictly prohibited.

## 2. Reuse Before Creation

Before creating any new file or module:
1. **Search First**: Thoroughly search the repository using pattern and symbol search tools.
2. **Identify Existing Owner**: Identify any existing module that shares the responsibility.
3. **Extend, Do Not Duplicate**: Extend the canonical module rather than creating a parallel or duplicate implementation.
4. **No Parallel Implementations**: Never build a secondary implementation of an existing capability (e.g., career memory, evidence wallet, apply engine, interview studio).

## 3. Prohibited Ambiguous File Names

Never create files with generic, numbered, temporary, or redundant names:

- `helper.ts` / `helpers.ts`
- `utils2.ts` / `newUtils.ts`
- `temp.ts` / `scratch.ts`
- `test2.ts`
- `service2.ts` / `manager2.ts`
- `newCareer.ts` / `newCareerLogic.ts`
- `final.ts` / `final2.ts`
- `old.ts` / `backup.ts`

Any new file must have a descriptive, domain-aligned name reflecting its single clear responsibility.
