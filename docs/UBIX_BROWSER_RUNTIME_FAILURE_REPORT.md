# UBIX Browser Runtime Failure Investigation & Resolution Report

## 1. Executive Summary & Root Cause

### 1.1 Exact Root Cause
The client-side browser freeze, unresponsive buttons, and permanent `"Loading Career Universe..."` state on `http://localhost:3000/` were caused by an **unhandled `EvalError` in `main-app.js` during Next.js client initialization in development mode**.

Next.js 14 Fast Refresh (`@next/react-refresh-utils`) uses Webpack's development mode evaluator (`eval-source-map`). Next.js forcibly overrides Webpack's `devtool` to `'eval-source-map'` in development and ignores user overrides in `next.config.js`. Concurrently, `next.config.js` sent a strict `Content-Security-Policy` header (`script-src 'self' 'unsafe-inline' ...`) without `'unsafe-eval'`. 

When the browser loaded `http://localhost:3000/`:
1. The browser executed `_next/static/chunks/main-app.js`.
2. Line 50 inside `@next/react-refresh-utils/dist/runtime.js` attempted to evaluate code via `eval()`.
3. The browser CSP engine intercepted the call and threw an unhandled `EvalError`.
4. This fatal exception terminated the entire JavaScript execution thread before React could mount or hydrate.
5. As a direct result:
   - React event listeners were never attached (Navbar "Sign In", "Get Started", "Enter Career System", and "Try as Guest" did not respond).
   - Dynamic imports (`UbixCareerGraph`) could not complete, leaving the initial static SSR fallback (`"Loading Career Universe..."`) displayed indefinitely.
   - Text elements wrapped in `<Reveal>` remained at inline `opacity: 0; transform: translateY(16px)` because `useReveal`'s `useEffect` was never executed by React.
   - Clicking `<a href="#">` for the logo caused the browser to navigate to `http://localhost:3000/#`.

### 1.2 Browser Console Error & Stack Trace
Captured live via Chrome DevTools Protocol (CDP) on the unpatched runtime:
```
[BROWSER UNCAUGHT EXCEPTION]: Uncaught EvalError: Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script: script-src 'self' 'unsafe-inline' https://translate.google.com https://translate.googleapis.com".

    at (app-pages-browser)/./node_modules/next/dist/compiled/@next/react-refresh-utils/dist/runtime.js (http://localhost:3000/_next/static/chunks/main-app.js:50:26)
    at options.factory (http://localhost:3000/_next/static/chunks/webpack.js:715:31)
    at __webpack_require__ (http://localhost:3000/_next/static/chunks/webpack.js:37:33)
    at __webpack_exec__ (http://localhost:3000/_next/static/chunks/main-app.js:2007:61)
    at http://localhost:3000/_next/static/chunks/main-app.js:2008:37
    at webpackJsonpCallback (http://localhost:3000/_next/static/chunks/webpack.js:1387:39)
    at http://localhost:3000/_next/static/chunks/main-app.js:9:61
```

### 1.3 Why Previous Tests Missed It
- `npm run build`: Production builds compile without Fast Refresh or `eval()`, generating minified bundles where CSP without `unsafe-eval` is 100% compliant and valid.
- `npm test`: Node.js test runners execute server-side endpoints and pure JS logic via `tsx`/`node:test` without loading Webpack's browser runtime or enforcing HTTP CSP headers.
- `npm run lint` & `npm run typecheck`: Only check static AST and TypeScript types.
- The failure was strictly an **environment-specific development runtime clash** between Webpack's dev Fast Refresh evaluator and the HTTP response header CSP.

---

## 2. Changes Implemented

1. **`next.config.js`**:
   - Conditioned the `Content-Security-Policy` HTTP response header to production/staging/test environments (`process.env.NODE_ENV !== "development"`).
   - In production (`next build` / `next start`), the CSP header remains strictly enforced with **zero** `unsafe-eval`.
   - In local development (`next dev`), omitting the CSP header on localhost prevents Next.js Fast Refresh from throwing `EvalError`, allowing full client hydration.

2. **`components/landing/LandingPage.tsx`**:
   - **`useReveal` Resilience**: Added safety timeout (`1500ms`) and lower intersection threshold (`0.05`). Content is never permanently hidden at `opacity: 0`.
   - **Logo Anchor Navigation**: Updated `<a href="#">` to `<a href="/" onClick={...}>` with smooth scroll to top, preventing `#` URL pollution.
   - **Header Navigation**: Added smooth scroll handlers to Product, How it works, and Accessibility links.

---

## 3. Verification & Diagnostic Status

| Verification Area | Status | Evidence / Observation |
| :--- | :--- | :--- |
| **Console Runtime Errors** | **FIXED** | 0 uncaught exceptions, 0 unhandled rejections in live Chrome CDP. |
| **React Hydration** | **VERIFIED** | React mounts immediately; event handlers attached to all buttons. |
| **Three.js Career Graph** | **VERIFIED** | `hasCanvas: true`, `"isStillLoadingUniverse": false`. Canvas pointer-events `none`. |
| **Hero Title & Content Visibility** | **VERIFIED** | `hasHeroTitle: true`, `heroTitleStyle.opacity: "1"`, `heroTitleText: "YOUR CAREER.CONNECTED."`. |
| **Sign In Button** | **VERIFIED** | `clickSigninRes: "CLICKED"`, `authFormPresent: true` (AuthGate opened). |
| **Enter Career System CTA** | **VERIFIED** | `clickHeroCta: "CLICKED"`, opens AuthGate modal cleanly. |
| **Try as Guest Flow** | **VERIFIED** | `guestClickRes: "CLICKED"`, redirects cleanly to `/` authenticated Assistant workspace in 1 request. |
| **Root Hash Routing** | **VERIFIED** | Navigation does not trigger unwanted URL `#` redirects. |
| **Production Build & CSP** | **VERIFIED** | `next build` compiled 30/30 pages cleanly; CSP enforced in production without `unsafe-eval`. |
| **Unit & Contract Tests** | **VERIFIED** | 295 passing tests, 0 failing, 1 skipped. |
| **Type Check & Lint** | **VERIFIED** | 0 TypeScript errors (`tsc --noEmit`), 0 ESLint warnings (`next lint`). |

---

## 4. Remaining Issues
None. Zero runtime exceptions, zero hydration failures, and full CTA interactivity across development and production environments.
