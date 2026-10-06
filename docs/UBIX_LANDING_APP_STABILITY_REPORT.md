# UBIX Landing & App Stability Engineering Report

## Executive Summary
This report documents the end-to-end investigation, stabilization, and verification of the UBIX Next.js 14 + React 18 + Three.js application across public and authenticated routes. 

All identified runtime failures—including rendering crashes, 3D WebGL memory leaks and CPU thread starvation, unhandled promise rejections during authentication, redundant guest login network storms, client bundle bloat on authenticated routes, and AI provider configuration drift—have been resolved. 

Zero UI redesigns, zero security downgrades, and zero fabricated AI or fallback data were introduced. Content Security Policy (CSP) headers remain strictly enforced with **zero** `unsafe-eval`.

---

## 1. Root Cause Analysis & Remediations

### 1.1 Three.js WebGL Resource Leaks & Main Thread Starvation
- **Problem**: 
  1. `UbixHeroScene.tsx` and `UbixCareerGraph.tsx` ran unthrottled `requestAnimationFrame` render loops even when scrolled out of view or backgrounded in another browser tab.
  2. Memory allocations inside the per-frame animate loop (`new THREE.Vector3()`, `new THREE.Color()`, matrix calculations) caused continuous garbage collection (GC) pauses.
  3. Window `resize` listeners did not account for actual container element dimensions, leading to stretched aspect ratios and unnecessary GPU texture reallocations.
  4. Device pixel ratio (DPR) was unbound, forcing mobile and high-DPI displays (e.g., Retina 3x) to render millions of unneeded fragments.
- **Remediation**:
  1. Implemented `IntersectionObserver` on both 3D scene canvas containers. When `isIntersecting === false`, render loops pause immediately and `cancelAnimationFrame` is called.
  2. Integrated `document.addEventListener("visibilitychange")` to pause all WebGL render loops whenever the browser tab is hidden.
  3. Replaced `window.addEventListener("resize")` with a dedicated `ResizeObserver` observing the canvas parent element.
  4. Capped DPR strictly to `Math.min(window.devicePixelRatio || 1, 1.75)`.
  5. Pre-allocated module-level reusable vectors and projections (`_tempScaleVec`, `_worldPos`, `_projected`, `_targetCam`) in `UbixCareerGraph.tsx`, eliminating all per-frame heap allocations.
  6. Added comprehensive WebGL cleanup in `useEffect` unmount hooks: calling `.dispose()` on all geometries, materials, line segments, textures, and invoking `renderer.dispose()` with WebGL context loss handling.

### 1.2 Graceful Degradation & 3D Error Containment
- **Problem**: A WebGL context loss, hardware limitation, or initialization failure in Three.js would crash the entire React component tree on the landing page and navigation routes.
- **Remediation**:
  1. Built [`components/ubix/Safe3DBoundary.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/components/ubix/Safe3DBoundary.tsx), a robust React Error Boundary tailored for WebGL viewports.
  2. If WebGL throws or canvas creation fails, it seamlessly displays a semantic, WCAG-compliant 7-stage interactive grid (`STATIC_CAREER_STAGES`) with accessible buttons, preserving the container height (`min-h-[580px]`) and layout flow without shifting content.
  3. Maintained all HTML overlay button layers on top of the canvas, strictly respecting `pointer-events-none` on the canvas itself.

### 1.3 Route Splitting & Authenticated Page Bloat
- **Problem**: `app/journey/page.tsx` and `app/roadmap/page.tsx` statically imported Three.js and `UbixCareerGraph`, forcing users navigating directly to authenticated workspace views to download heavy 3D bundles synchronously.
- **Remediation**:
  1. Converted `UbixCareerGraph` in both [`app/journey/page.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/app/journey/page.tsx) and [`app/roadmap/page.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/app/roadmap/page.tsx) to `next/dynamic` with `ssr: false`.
  2. Implemented lightweight, token-compliant pulsing skeletons during chunk load.
  3. In [`components/landing/LandingPage.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/components/landing/LandingPage.tsx), the secondary 3D scene (`UbixHeroScene` in Section 3) is now viewport-gated via a dynamic `LazyIntelligenceHero` component.

### 1.4 Authentication Reliability & Guest Network Redundancy
- **Problem**: 
  1. Clicking "Explore as Guest" in [`app/page.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/app/page.tsx) or [`components/auth/AuthGate.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/components/auth/AuthGate.tsx) triggered a request to `POST /api/auth/login`, received a guest user object, and then called `signIn(data.user.email)`. Because `signIn` checked `email.startsWith("guest_")`, it immediately dispatched a **second** identical `POST /api/auth/login` request.
  2. In [`lib/store.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/lib/store.tsx), `signIn`, `signInWithGithub`, and `signInWithPhone` contained silent catch blocks that fell back to generating unverified local user sessions without server-issued HMAC cookies.
- **Remediation**:
  1. Added canonical `signInAsGuest()` to [`lib/store.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/lib/store.tsx) that makes exactly **one** authoritative call to `/api/auth/login`, verifies the server response, and sets the authenticated state.
  2. Added `setAuthenticatedUser(user)` helper to hydrate the authenticated user directly from the verified API response in [`components/auth/AuthGate.tsx`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/components/auth/AuthGate.tsx), eliminating redundant secondary logins.
  3. Made all auth methods in `lib/store.tsx` server-authoritative: if the server fails, an informative error is thrown rather than creating a fake unauthenticated session.

### 1.5 Webpack DevTool vs Content Security Policy (CSP)
- **Problem**: In Next.js development mode, the default devtool is `eval-source-map`, which executes source mapping via `eval()`. This conflicted with the strict production CSP header `script-src 'self' 'unsafe-inline'`, triggering `EvalError` in dev mode.
- **Remediation**:
  1. Preserved CSP headers strictly without adding `'unsafe-eval'`.
  2. Configured Next.js webpack in `next.config.js`: `config.devtool = "cheap-module-source-map"` for dev mode, avoiding runtime `eval()` while retaining source mapping.

### 1.6 Canonical AI Provider Configuration Alignment
- **Problem**: `lib/ai/providerConfig.ts` had drifted to `CANONICAL_PROVIDER = "gemini"`, contradicting the architecture specification and central orchestration which designates OpenAI (`gpt-4o-mini`) as the canonical provider.
- **Remediation**:
  1. In [`lib/ai/providerConfig.ts`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/lib/ai/providerConfig.ts): set `CANONICAL_PROVIDER = "openai"`, `CANONICAL_MODEL = PROVIDER_MODELS.openai`, and `PROVIDER_ORDER = ["openai", "gemini", "groq", "openrouter", "anthropic"]`.
  2. In [`lib/ai/centralProvider.ts`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/lib/ai/centralProvider.ts): updated provider cascade sequence to start with OpenAI followed by Gemini, Groq, and OpenRouter.
  3. Updated unit tests in [`tests/unit/ai_provider_safety.test.mjs`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/tests/unit/ai_provider_safety.test.mjs) and [`tests/unit/assistant_chat_contract.test.mjs`](file:///c:/Users/MANAN/OneDrive/Desktop/careerforge/tests/unit/assistant_chat_contract.test.mjs) to validate OpenAI canonical defaults and secrets protection.

---

## 2. Verification & Validation Metrics

| Check | Tool / Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Type Integrity** | `npm run typecheck` | **PASS (0 errors)** | Full TypeScript project check (`tsc --noEmit`) |
| **Code Hygiene** | `npm run lint` | **PASS (0 errors, 0 warnings)** | Next.js ESLint passed across all 30 routes |
| **Design Tokens** | `node scripts/lint_design_tokens.mjs` | **PASS (0 violations)** | Full Tailwind design token compliance |
| **Test Suite** | `npm test` | **PASS (295 passed, 1 skipped)** | 296 unit/security/contract tests executed |
| **Production Build** | `npm run build` | **PASS (30/30 pages compiled)** | Production bundles generated cleanly |
| **Git Diff Cleanliness** | `git diff --check` | **PASS (0 warnings)** | Zero trailing whitespaces or patch conflicts |

### Production Bundle Size Improvements
- `/journey`: Route footprint reduced to **2.48 kB** (First Load JS: 399 kB).
- `/roadmap`: Route footprint reduced to **1.98 kB** (First Load JS: 383 kB).
- `/`: Initial route footprint is **47.9 kB** with lazy viewport-gated 3D scenes.

---

## 3. Compliance Summary
- [x] No UI redesigns or unrequested visual modifications.
- [x] No changes to Supabase authentication architecture.
- [x] No replacement of Three.js with external libraries.
- [x] No fake AI responses or synthetic data generators added.
- [x] Preserved WCAG 2.1 AA accessibility features, screen-reader headings, and focus rings.
- [x] Preserved HTML overlay interaction layers (`pointer-events-none` on canvas).
- [x] Content Security Policy preserved with NO `unsafe-eval`.
