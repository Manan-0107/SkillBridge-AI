# CareerForge — Roadmap & Daily Practice Engine

A CDN-first learning-roadmap platform combining an interactive, branching visual roadmap tree with a client-side daily practice quiz engine.

---

## 0. Non-Negotiable Architecture

```
CDN (S3/Cloudflare R2) ──► Static JSON ──► React Native Fetch ──► Browser localStorage
```

### Core Tenets
1. **Zero Runtime Server Compute**: Next.js request paths never query a database, execute dynamic server components, or issue API route requests for data.
2. **Immutable CDN Assets**: Roadmap documents (`/data/roadmap/[roadmapId].json`) and Daily Practice Sets (`/data/practice/[track]/[YYYY-MM-DD].json`) are statically hosted with HTTP header:
   ```http
   Cache-Control: public, max-age=86400, immutable
   Content-Type: application/json
   ```
3. **Client-Side Personalization**: All user state (progress, checklist completions, quiz answer history, active filters) is stored exclusively in `localStorage`, namespaced by `roadmap:{roadmapId}:v{schemaVersion}`.
4. **Litmus Test**: *"Does the server need to know something about this specific user at request time?"* If yes, it is redesigned as client computation over static JSON + localStorage.

---

## 1. Architectural Decisions & Justifications

### Hand-Rolled SVG Connectors vs Graph Libraries
Instead of pulling in heavy third-party graph dependencies (React Flow / Cytoscape) that add 200KB+ to the client bundle and struggle with custom accessible roving tabindexes, the roadmap tree uses **pure 2D coordinate calculations in `lib/graph.ts`** and native SVG cubic bezier curves:
- Fast initial paint with zero CLS (Cumulative Layout Shift).
- Roving tabindex and semantic `role="treeitem"` out-of-the-box.
- Seamless CSS transform and accent-glow animations.

### Lightweight Local State vs Redux/Zustand
Because the data model is CDN-first and progress is purely client-side, external state managers (Redux / MobX) introduce unnecessary complexity. The application uses clean custom hooks (`lib/storage.ts`, `lib/cdn-fetch.ts`) with robust version checking, JSON error guarding, and in-memory fallbacks if storage quotas or private browsing restrictions occur.

### Scaling & Payload Optimization Note
The Frontend roadmap payload currently contains 18 comprehensive nodes (~15KB gzipped). If tracks expand past 60+ nodes, documents can be split into stage chunks (e.g. `/data/roadmap/[roadmapId]/stage-[N].json`) loaded progressively.

---

## 2. Directory Structure

```
/app/roadmap/[roadmapId]/page.tsx      # Dynamic roadmap view (CDN fetch + drawer)
/app/practice/[track]/page.tsx         # Daily practice quiz view
/components/roadmap/
  ├── RoadmapTree.tsx                  # Canvas & SVG overlay
  ├── RoadmapNode.tsx                  # Accessible node card with roving tabindex
  ├── Connector.tsx                    # Hand-rolled cubic bezier SVG connector
  ├── SearchBar.tsx                    # 150ms debounced client search
  ├── FilterBar.tsx                    # URL-synced status and track filters
  ├── NodeDrawer.tsx                   # Responsive desktop drawer / mobile bottom sheet
  └── ConceptChecklist.tsx             # Persisted concept verification checklist
/components/practice/
  ├── DailyPracticeList.tsx            # 10-question sequencing with review mode
  ├── QuestionCard.tsx                 # MCQ & short answer card
  └── ResultsSummary.tsx               # Client-calculated score and breakdown metrics
/components/shared/
  ├── Skeleton.tsx                     # Zero-CLS skeletons
  ├── Badge.tsx                        # Accessible status triad badges
  └── FocusTrap.tsx                    # Modal keyboard trap
/lib/
  ├── cdn-fetch.ts                     # Native fetch with bounded retry
  ├── storage.ts                       # Safe versioned localStorage utility
  ├── graph.ts                         # Pure layout & selection derivation
  └── dates.ts                         # UTC date resolution
/types/
  ├── roadmap.ts                       # TypeScript interfaces
  ├── practice.ts
  └── storage.ts
/data/example/                         # Local development fixtures
/scripts/
  ├── models.py                        # Pydantic V2 schemas
  ├── generate.py                      # Daily generator & validation pipeline
  ├── upload.py                        # S3/R2 CDN upload utility
  └── requirements.txt
/tests/
  ├── unit/                            # Vitest/Node unit test suites
  └── e2e/                             # Playwright e2e test
DESIGN.md                              # Typography, color tokens, and motion guidelines
```

---

## 3. Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Next.js Development Server
```bash
npm run dev
```
- Open [http://localhost:3000/roadmap/frontend](http://localhost:3000/roadmap/frontend) to view the interactive tree.
- Open [http://localhost:3000/practice/frontend](http://localhost:3000/practice/frontend) to take today's daily practice drill.

### 3. Run Unit Tests
```bash
npm test
```

---

## 4. Python Generator & CDN Pipeline

The daily quiz pipeline runs daily at 00:00 UTC via GitHub Action:

```bash
# Validate all existing static JSON files with Pydantic schemas (dry run)
python scripts/generate.py --dry-run

# Preview S3/R2 uploads with immutable Cache-Control headers
python scripts/upload.py --dry-run
```
