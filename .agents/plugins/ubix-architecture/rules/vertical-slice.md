# UBIX Architecture Governance: Vertical Slice Implementation

## 1. Vertical Implementation Workflow

All future UBIX features must be delivered as integrated vertical slices rather than horizontally fragmented tiers.

### The Required Execution Sequence:
```
1. Existing Domain Logic Inspection (lib/*)
                 ↓
2. Persistence & Supabase Schema Verification (lib/db.ts, migrations)
                 ↓
3. Authenticated Server API (app/api/*)
                 ↓
4. UI Component Creation (components/*)
                 ↓
5. Navigation & Discoverable Entry Point (app/*, TopNav)
                 ↓
6. Accessibility Integration (aria-live, keyboard, screen-reader labels)
                 ↓
7. Browser Interaction Verification (CDP / browser tests)
                 ↓
8. Reload & Persistence Durability Verification
                 ↓
9. Multi-Tenant Isolation Verification
                 ↓
10. Automated Tests (npm test, typecheck, lint, build)
```

## 2. Prohibition of Horizontal Silos

- **No Backend-Only Batches**: Never implement multiple backend endpoints while postponing UI integration. Every backend capability must have a corresponding, accessible, tested UI entry point.
- **No Mock Stubs in Production**: Never deploy client-only state pretending to be a completed feature.
