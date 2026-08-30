# CareerForge

Minimalist career-acceleration app: resume tooling, dynamic roadmaps, curated courses,
a gamified practice hub, and a local-opportunities finder.

## Setup

```
npm install
cp .env.local.example .env.local   # fill in keys, see notes below
npm run dev
```

## Where real integrations plug in

- **Google OAuth** — `components/auth/AuthGate.tsx` has a `handleGoogleAuth()` stub.
  Wire it to `@react-oauth/google` (or NextAuth's Google provider) using
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Email/password currently persists to `localStorage`
  only — swap `lib/store.tsx`'s `signUp`/`signIn` for real API calls.
- **Resume Analyzer** — `components/resume/Analyzer.tsx` runs a local keyword-overlap
  heuristic (`lib/resumeHeuristics.ts`) so the module works with zero backend. Point
  `analyzeResume()` at a real LLM/ATS-scoring endpoint when ready.
- **Google Maps Places** — `components/local/LocalOpportunities.tsx` uses mock data
  by default. With `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set, swap the mock fetch for the
  Places API `nearbySearch`/Text Search call (see comment block in that file).
- **Udemy / Coursera** — `lib/data.ts` `courseCatalog` holds curated deep links per
  role. Replace with live calls to Udemy Affiliate API / Coursera API if desired.
- **Codédex / Codepip** — static outbound links in `components/practice/PracticeHub.tsx`.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS. No backend required to run —
state persists to `localStorage` via `lib/store.tsx` so the whole flow (auth →
onboarding → suite) is demoable out of the box.
