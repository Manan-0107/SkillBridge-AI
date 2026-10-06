# UBIX Runtime Failure Audit (Baseline Pre-Fix Investigation)

**Date**: 2026-10-06  
**Environment**: Windows 11, Next.js 14.2.35, React 18.3.1, TypeScript 5.5.4, Three.js 0.186.1, Node.js  
**Status**: BASELINE REPRODUCED & AUDITED (Zero Code Changes Pre-Fix)

---

## 1. Executive Summary

A comprehensive pre-fix audit was conducted across all required routes, build targets, unit tests, and runtime environments. The application was evaluated across production build (`next build`), unit tests (`npm test`), lint (`next lint`), TypeScript check (`tsc --noEmit`), and runtime execution via development server with real browser interaction.

### Key Failures & Structural Defects Identified:
1. **Next.js Dev Server CSP vs Eval Mismatch**: In development mode, Next.js / Webpack React Refresh invokes `eval()`, but `next.config.js` enforces a strict CSP without `'unsafe-eval'`. This causes an `EvalError` in the browser console on dev mode, halting client-side React hydration on the landing page and preventing button interactivity (`Sign In`, `Get Started`, `Enter Career System`) from firing click handlers in dev mode.
2. **Dual Active Three.js Scenes & RAF Loops on Landing**: The landing page initializes both `UbixCareerGraph` (Hero) and `UbixHeroScene` (Section 3). Both start requestAnimationFrame loops simultaneously on initial page load, even though Section 3 is far below the viewport fold. Neither loop halts when scrolled out of view or when document visibility is hidden.
3. **Per-Frame Memory Allocation Spikes in Career Graph**: `UbixCareerGraph` allocates over 25 `new THREE.Vector3()` instances on every single frame inside its render loop (8 allocations for node/core scaling + 14 for projected coordinates + camera lerp). This causes continuous garbage collector churn at 60fps. Additionally, `setJourneyStage` triggers React state setter updates inside the animation loop.
4. **Heavy Three.js Statically Bundled into Authenticated Routes**: `app/journey/page.tsx` and `app/roadmap/page.tsx` directly imported `UbixCareerGraph` as a static import instead of client-side `dynamic(..., { ssr: false })`, inflating `/journey` to 551 kB First Load JS and `/roadmap` to 535 kB First Load JS.
5. **Missing Three.js Error Boundary**: There is no client-side error boundary around `UbixCareerGraph`. If WebGL context creation fails or Three.js throws, the landing page hero is left in an unhandled state without a clean, accessible static fallback.
6. **Authentication Local Fallback Security Flaw**: In `lib/store.tsx`, when server `/api/auth/login` fails, `signIn`, `signInWithGithub`, and `signInWithPhone` create a local-only `User` object and persist it to localStorage, fabricating an authenticated session when the server explicitly failed to authenticate.
7. **Guest Login Double Call**: On the landing page (`app/page.tsx`), clicking "Try as Guest" calls `/api/auth/login` (guest), then passes the returned guest email to `signIn()`, which checks if the email starts with `guest_` and calls `/api/auth/login` (guest) a SECOND time, creating two guest sessions.
8. **AI Provider Configuration Drift**: `lib/ai/providerConfig.ts` sets `CANONICAL_PROVIDER = "gemini"` and `CANONICAL_MODEL = PROVIDER_MODELS.gemini`, directly contradicting the architecture documentation, comments, and central orchestration where OpenAI is intended as the primary canonical provider.

---

## 2. Command Pipeline Verification Matrix

| Command | Exit Code | Result | Key Details |
| :--- | :---: | :---: | :--- |
| `npm run typecheck` | `0` | **PASS** | `tsc --noEmit` completed with zero TypeScript errors. |
| `npm run lint` | `0` | **PASS** | `next lint` completed with `✔ No ESLint warnings or errors`. |
| `npm test` | `0` | **PASS** | 295 tests executed: 294 passed, 1 skipped (live AI smoke test requiring network key), 0 failed. |
| `npm run build` | `0` | **PASS** | Static page generation 30/30 succeeded. Static bundle sizes: `/` (463 kB), `/roadmap` (535 kB), `/journey` (551 kB). |

---

## 3. Comprehensive Route Audit Matrix

| Route | Exists | HTTP Status | Initial Render Time | Console Errors | Three.js Init | API Failures | Buttons Clickable | Navigation Works | Usable on API Fail |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `/` (Landing) | Yes | 200 | ~220ms | CSP `EvalError` in dev mode | Blocked by dev CSP / Fallback shows | None on load | Blocked in dev by CSP eval error | Pending hydration | Yes (static content rendered) |
| `/roadmap` | Yes | 200 | ~1600ms | None | Static bundle | `/api/roadmap` (needs mock or user) | Yes | Yes | Partial (empty states needed) |
| `/journey` | Yes | 200 | ~730ms | None | Static bundle | None | Yes | Yes | Partial |
| `/learning` | Yes | 200 | ~580ms | None | N/A | None | Yes | Yes | Yes |
| `/practice` | Yes | 200 | ~660ms | None | N/A | None | Yes | Yes | Yes |
| `/practice/frontend` | Yes | 200 | ~3040ms | None | N/A | None | Yes | Yes | Yes |
| `/jobs` | Yes | 200 | ~840ms | None | N/A | None | Yes | Yes | Yes |
| `/opportunities` | Yes | 200 | ~730ms | None | N/A | None | None | Yes | Yes | Partial |
| `/resume` | Yes | 200 | ~625ms | None | N/A | None | Yes | Yes | Partial |
| `/progress` | Yes | 200 | ~650ms | None | N/A | None | Yes | Yes | Partial |
| `/auth` | No | 404 | N/A | N/A | N/A | N/A | N/A | N/A | **NOT APPLICABLE** (AuthGate is a client modal on `/`) |
| `/login` | No | 404 | N/A | N/A | N/A | N/A | N/A | N/A | **NOT APPLICABLE** |
| `/signup` | No | 404 | N/A | N/A | N/A | N/A | N/A | N/A | **NOT APPLICABLE** |

---

## 4. Architectural Defect Deep Dives

### Phase 1 & 2: Landing Page & Three.js Performance
- **Dual Scenes**: Landing renders `UbixCareerGraph` at the top and `UbixHeroScene` in Section 3 without viewport intersection gating. Both start active animation frames immediately.
- **Pointer Events**: As noted in the prompt requirements, `canvas.style.pointerEvents = "none"` is intentional and necessary because interactive graph node HTML buttons are positioned directly over the canvas. This architecture is preserved.
- **RAF Loop Optimization**: Loops in both components run constantly without checking `document.hidden` or IntersectionObserver visibility, wasting CPU/GPU cycles.
- **Allocation Inefficiencies**: `UbixCareerGraph` instantiates `new THREE.Vector3()` over 25 times per frame.

### Phase 3: Dynamic Import on Authenticated Routes
- `app/journey/page.tsx` and `app/roadmap/page.tsx` directly import `UbixCareerGraph` synchronously:
  ```ts
  import { UbixCareerGraph, CareerNodeId } from "@/components/ubix/UbixCareerGraph";
  ```
  This pulls the entire Three.js bundle into both routes, bloating first-load JS to >530kB. They must use `dynamic(..., { ssr: false })` and `import type { CareerNodeId }`.

### Phase 4: Three.js Error Isolation
- Neither `LandingPage` nor route components wrap `UbixCareerGraph` in an Error Boundary. If WebGL context creation fails or an uncaught Three.js exception occurs, the layout can break without a graceful, accessible fallback.

### Phase 6: Server-Authoritative Authentication Fallback Flaw
- In `lib/store.tsx` (`signIn`, `signInWithGithub`, `signInWithPhone`):
  When `/api/auth/login` returns an error or fails network fetch, the code falls back to:
  ```ts
  const localUser: User = { name: displayName, email: cleanEmail, ... };
  persist(localUser);
  ```
  This creates a client-side session bypass! If the server fails to authenticate or rejects credentials, the user is still logged in locally. This must be eliminated. Authentication failure must be treated strictly as an error, displaying a clean user-facing notification.

### Phase 7: Guest Login Duplication
- In `app/page.tsx`:
  ```ts
  const handleGuestLogin = async () => {
    const res = await fetch("/api/auth/login", { body: JSON.stringify({ mode: "guest" }) });
    const data = await res.json();
    if (data.success && data.user) {
      await signIn(data.user.email, data.user.name); // Calls /api/auth/login AGAIN!
    }
  };
  ```
  Because `cleanEmail.startsWith("guest_")`, `signIn()` makes a second redundant `/api/auth/login` request. One canonical guest creation flow is required.

### Phase 9: AI Provider Configuration Drift
- In `lib/ai/providerConfig.ts`:
  `export const CANONICAL_PROVIDER = "gemini" as const;`
  Contradicts file header:
  `Canonical AI Provider: OpenAI (gpt-4o-mini / gpt-4o)`
  And `centralProvider.ts` cascade documentation.
  Must align canonical provider to `openai` with fallbacks `gemini`, `groq`, `openrouter`, `anthropic`, while maintaining strict honest failure semantics and updating corresponding unit tests.

### Phase 10: API Failure & Degradation Behavior
- When APIs (`/api/roadmap`, `/api/jobs`, `/api/resume/parse`) fail, pages must display dedicated loading, empty, and retry states without inventing fake data or throwing uncaught exceptions.
