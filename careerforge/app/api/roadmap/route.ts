import { NextRequest, NextResponse } from "next/server";
import {
  RoadmapApiResponse,
  RoadmapTreeData,
  TechCategory,
  RoadmapTier,
  RoadmapNode,
} from "@/types/roadmapTree";
import { getRoadmapTrackData } from "@/lib/roadmap/roadmapData";

// =========================================================================
// HIGH-PERFORMANCE ROADMAP TREE DATASETS (SIMULATING REDIS CACHED TREES)
// =========================================================================

const frontendTiers: RoadmapTier[] = [
  {
    id: "stage-fe-1",
    stageNumber: 1,
    title: "Internet & Foundations",
    subtitle: "Understand the core architecture before writing code",
    category: "frontend",
    trunkNode: {
      id: "node-fe-internet",
      title: "How the Internet Works",
      slug: "how-the-internet-works",
      category: "frontend",
      level: "fundamental",
      importance: "essential",
      status: "completed",
      estimatedHours: 12,
      badge: "Must Know",
      summary: "Understand protocols, packets, clients, servers, and DNS resolution.",
      description:
        "The web is a distributed system governed by protocols. Understanding how packets travel over TCP/IP, how DNS resolves domain names into IP addresses, and how HTTP client-server cycles work is the cornerstone of every web developer's engineering journey.",
      keyConcepts: [
        "IP Addressing & Subnets",
        "DNS Hierarchy & Caching",
        "TCP/IP Handshake",
        "HTTP/1.1 vs HTTP/2 vs HTTP/3",
        "TLS/SSL Encryption & Certificates",
      ],
      checklist: [
        {
          id: "chk-fe-1",
          title: "Understand the 3-way TCP handshake (SYN, SYN-ACK, ACK)",
          completed: true,
        },
        {
          id: "chk-fe-2",
          title: "Explain DNS recursive lookup from root servers to authoritative NS",
          completed: true,
        },
        {
          id: "chk-fe-3",
          title: "Trace an HTTP GET request using curl or browser DevTools Network tab",
          completed: true,
        },
        {
          id: "chk-fe-4",
          title: "Understand HTTPS TLS 1.3 handshake and asymmetric vs symmetric cryptography",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-fe-1",
          title: "How the Web Works — MDN Official Guide",
          url: "https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Web_mechanics/How_does_the_Internet_work",
          type: "documentation",
          provider: "MDN Web Docs",
          badge: "Essential",
          isFree: true,
        },
        {
          id: "res-fe-2",
          title: "How DNS Works Comic & Interactive Explainer",
          url: "https://howdns.works/",
          type: "article",
          provider: "DNS Explained",
          isFree: true,
        },
        {
          id: "res-fe-3",
          title: "Computer Networking Course — Network Protocols",
          url: "https://www.youtube.com/watch?v=IPvYjXCsTg8",
          type: "video",
          provider: "freeCodeCamp",
          duration: "2.5 hrs",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-fe-dns-http",
        title: "HTTP Methods & Status Codes",
        slug: "http-methods-and-status-codes",
        category: "frontend",
        level: "fundamental",
        importance: "essential",
        status: "completed",
        estimatedHours: 8,
        branchType: "left-branch",
        summary: "REST semantics, headers, status codes, and HTTP caching.",
        description:
          "Deep dive into idempotent vs non-idempotent HTTP verbs (GET, POST, PUT, PATCH, DELETE, OPTIONS), cache-control directives, and status code groups (2xx, 3xx, 4xx, 5xx).",
        keyConcepts: [
          "Idempotency & Safety",
          "Cache-Control, ETag & Stale-While-Revalidate",
          "CORS preflight & Access-Control headers",
          "MIME types & Content Negotiation",
        ],
        checklist: [
          {
            id: "chk-http-1",
            title: "Differentiate PUT vs PATCH in REST architecture",
            completed: true,
          },
          {
            id: "chk-http-2",
            title: "Configure proper CORS headers on a dev server",
            completed: true,
          },
          {
            id: "chk-http-3",
            title: "Simulate 304 Not Modified using conditional If-None-Match headers",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-http-1",
            title: "HTTP Status Codes Spec & Reference",
            url: "https://httpstatuses.io/",
            type: "documentation",
            provider: "HTTP Reference",
            isFree: true,
          },
        ],
      },
      {
        id: "node-fe-devtools",
        title: "Browser DevTools & Network",
        slug: "browser-devtools-profiling",
        category: "frontend",
        level: "fundamental",
        importance: "recommended",
        status: "completed",
        estimatedHours: 6,
        branchType: "right-branch",
        summary: "Inspect DOM, diagnose network waterfalls, and debug JavaScript runtime.",
        description:
          "Modern Chrome & Firefox DevTools provide superpowers for debugging DOM reflows, network waterfall bottlenecks, memory leaks, and CPU throttling.",
        keyConcepts: [
          "Network Waterfall & TTFB Analysis",
          "Breakpoints & Call Stack Debugging",
          "Performance Timeline & Frame Rates",
          "Lighthouse Auditing",
        ],
        checklist: [
          {
            id: "chk-dev-1",
            title: "Use conditional breakpoints in source debugger",
            completed: true,
          },
          {
            id: "chk-dev-2",
            title: "Profile page load and identify longest blocking tasks",
            completed: true,
          },
        ],
        resources: [
          {
            id: "res-dev-1",
            title: "Chrome DevTools Official Documentation",
            url: "https://developer.chrome.com/docs/devtools/",
            type: "documentation",
            provider: "Google Chrome",
            isFree: true,
          },
        ],
      },
    ],
  },
  {
    id: "stage-fe-2",
    stageNumber: 2,
    title: "HTML & Semantic Web",
    subtitle: "Structure accessible, machine-readable documents",
    category: "frontend",
    trunkNode: {
      id: "node-fe-html5",
      title: "HTML5 & Semantic Markup",
      slug: "html5-and-semantic-markup",
      category: "frontend",
      level: "fundamental",
      importance: "essential",
      status: "completed",
      estimatedHours: 14,
      badge: "Core",
      summary: "Modern semantic tags, document outlines, and form validations.",
      description:
        "HTML is not just layout syntax; it is the semantic ontology of the web. Proper use of `<main>`, `<article>`, `<section>`, `<nav>`, `<aside>`, and native inputs ensures accessibility, SEO, and robust mobile ergonomics.",
      keyConcepts: [
        "Semantic Document Outline",
        "Form Attributes & Built-in Validation",
        "Audio, Video & Picture Elements",
        "Shadow DOM & Custom Elements",
      ],
      checklist: [
        {
          id: "chk-html-1",
          title: "Build an accessible registration form with native constraint validation",
          completed: true,
        },
        {
          id: "chk-html-2",
          title: "Eliminate `<div>` soup using semantic tags (`header`, `main`, `nav`)",
          completed: true,
        },
        {
          id: "chk-html-3",
          title: "Implement responsive images using `<picture>` and `srcset`",
          completed: true,
        },
      ],
      resources: [
        {
          id: "res-html-1",
          title: "HTML Living Standard by WHATWG",
          url: "https://html.spec.whatwg.org/",
          type: "documentation",
          provider: "WHATWG",
          isFree: true,
        },
        {
          id: "res-html-2",
          title: "HTML5 Semantic Elements Deep Dive",
          url: "https://www.freecodecamp.org/news/semantic-html5-elements/",
          type: "article",
          provider: "freeCodeCamp",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-fe-a11y",
        title: "Accessibility (a11y) & WCAG",
        slug: "accessibility-a11y-wcag",
        category: "frontend",
        level: "intermediate",
        importance: "essential",
        status: "in-progress",
        estimatedHours: 16,
        branchType: "left-branch",
        summary: "WCAG 2.2 AA compliance, ARIA attributes, and screen reader testing.",
        description:
          "Digital accessibility ensures equal access for users with auditory, visual, mobility, or cognitive disabilities. Master keyboard navigation, focus management, color contrast, and ARIA roles.",
        keyConcepts: [
          "WCAG 2.2 AA Standards",
          "ARIA Roles, States, and Properties",
          "Focus Rings, Trapping, and Skip Links",
          "Screen Reader Testing (VoiceOver, NVDA)",
        ],
        checklist: [
          {
            id: "chk-a11y-1",
            title: "Test complete keyboard navigation without a mouse",
            completed: true,
          },
          {
            id: "chk-a11y-2",
            title: "Ensure 4.5:1 minimum color contrast across dark and light themes",
            completed: true,
          },
          {
            id: "chk-a11y-3",
            title: "Build a modal dialog with focus lock and ESC key dismissal",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-a11y-1",
            title: "The A11Y Project Checklist",
            url: "https://www.a11yproject.com/checklist/",
            type: "documentation",
            provider: "A11Y Project",
            isFree: true,
          },
        ],
      },
      {
        id: "node-fe-seo",
        title: "SEO & OpenGraph Metadata",
        slug: "seo-opengraph-structured-data",
        category: "frontend",
        level: "intermediate",
        importance: "recommended",
        status: "completed",
        estimatedHours: 8,
        branchType: "right-branch",
        summary: "Meta tags, OpenGraph social cards, and JSON-LD schema.",
        description:
          "Search engines and social sharing platforms parse OpenGraph metadata and JSON-LD structured schema. Learn canonical tags, robots.txt, and sitemaps.",
        keyConcepts: [
          "Open Graph & Twitter Cards",
          "JSON-LD Schema Markup",
          "Canonical URL Links",
          "Sitemaps & Robots.txt Directives",
        ],
        checklist: [
          {
            id: "chk-seo-1",
            title: "Add dynamic OpenGraph image generation to Next.js routes",
            completed: true,
          },
          {
            id: "chk-seo-2",
            title: "Validate rich snippets with Google Rich Results Test",
            completed: true,
          },
        ],
        resources: [
          {
            id: "res-seo-1",
            title: "Google Search Central: SEO Starter Guide",
            url: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide",
            type: "documentation",
            provider: "Google",
            isFree: true,
          },
        ],
      },
    ],
  },
  {
    id: "stage-fe-3",
    stageNumber: 3,
    title: "CSS & Modern Styling Architecture",
    subtitle: "Design systems, layout algorithms, and styling engines",
    category: "frontend",
    trunkNode: {
      id: "node-fe-css",
      title: "CSS Layouts: Flexbox & Grid",
      slug: "css-layouts-flexbox-grid",
      category: "frontend",
      level: "fundamental",
      importance: "essential",
      status: "completed",
      estimatedHours: 20,
      badge: "Core",
      summary: "Master 1D Flexbox, 2D Grid, CSS custom properties, and box-sizing.",
      description:
        "Flexbox and Grid form the dual engines of modern web layout. Combine them with CSS custom properties (variables) and `@container` queries for bulletproof responsive interfaces.",
      keyConcepts: [
        "Box Model & box-sizing: border-box",
        "Flexbox Alignment & Axis Distribution",
        "CSS Grid Template Areas & Repeat/Auto-fit",
        "CSS Custom Properties & Theming",
        "Container Queries (`@container`)",
      ],
      checklist: [
        {
          id: "chk-css-1",
          title: "Build a responsive holy-grail layout using CSS Grid",
          completed: true,
        },
        {
          id: "chk-css-2",
          title: "Implement dark/light theme switching using CSS variables",
          completed: true,
        },
        {
          id: "chk-css-3",
          title: "Replace media queries with container queries on reusable card components",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-css-1",
          title: "A Complete Guide to CSS Grid",
          url: "https://css-tricks.com/snippets/css/complete-guide-grid/",
          type: "article",
          provider: "CSS-Tricks",
          isFree: true,
        },
        {
          id: "res-css-2",
          title: "A Complete Guide to Flexbox",
          url: "https://css-tricks.com/snippets/css/a-guide-to-flexbox/",
          type: "article",
          provider: "CSS-Tricks",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-fe-tailwind",
        title: "Tailwind CSS & Utility Systems",
        slug: "tailwind-css-utility-design",
        category: "frontend",
        level: "intermediate",
        importance: "essential",
        status: "completed",
        estimatedHours: 12,
        branchType: "left-branch",
        summary: "Utility-first workflows, arbitrary values, and design tokens.",
        description:
          "Tailwind CSS standardizes sizing, typography, and spacing scales. Its JIT engine produces ultra-compact stylesheets and enables rapid prototyping with design tokens.",
        keyConcepts: [
          "Utility-First Architecture",
          "Arbitrary Values & Variant Modifiers",
          "Tailwind Config & Plugin Ecosystem",
          "shadcn/ui & Headless UI integration",
        ],
        checklist: [
          {
            id: "chk-tw-1",
            title: "Configure custom colors and font tokens in tailwind.config",
            completed: true,
          },
          {
            id: "chk-tw-2",
            title: "Build an animated slide-over drawer with Tailwind classes",
            completed: true,
          },
        ],
        resources: [
          {
            id: "res-tw-1",
            title: "Tailwind CSS Official Documentation",
            url: "https://tailwindcss.com/docs",
            type: "documentation",
            provider: "Tailwind Labs",
            isFree: true,
          },
        ],
      },
      {
        id: "node-fe-animations",
        title: "CSS Animations & Framer Motion",
        slug: "animations-and-micro-interactions",
        category: "frontend",
        level: "intermediate",
        importance: "recommended",
        status: "in-progress",
        estimatedHours: 10,
        branchType: "right-branch",
        summary: "GPU-accelerated transforms, transitions, and declarative physics.",
        description:
          "Animate only composite properties (`transform`, `opacity`) to maintain 60/120fps fluid motion. Use Framer Motion for layout animations and drag gestures.",
        keyConcepts: [
          "GPU Compositing Layers",
          "CSS `@keyframes` and cubic-bezier timing",
          "Framer Motion Layout & Exit Animations",
          "Respecting `prefers-reduced-motion`",
        ],
        checklist: [
          {
            id: "chk-anim-1",
            title: "Create smooth hover lift effects with `translate3d` and GPU layer",
            completed: true,
          },
          {
            id: "chk-anim-2",
            title: "Implement accessible modal enter/leave transitions with exit animations",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-anim-1",
            title: "Framer Motion API Reference",
            url: "https://www.framer.com/motion/",
            type: "documentation",
            provider: "Framer",
            isFree: true,
          },
        ],
      },
    ],
  },
  {
    id: "stage-fe-4",
    stageNumber: 4,
    title: "JavaScript & TypeScript Deep Engine",
    subtitle: "The language runtime, event loop, and static type system",
    category: "frontend",
    trunkNode: {
      id: "node-fe-js-deep",
      title: "Modern JavaScript (ES2024+) & Event Loop",
      slug: "modern-javascript-event-loop",
      category: "frontend",
      level: "fundamental",
      importance: "essential",
      status: "completed",
      estimatedHours: 35,
      badge: "Crucial",
      summary: "V8 engine internals, microtask queue, closures, prototypes, and asynchronous patterns.",
      description:
        "Master the JavaScript runtime: call stack, memory heap, Web APIs, task queue vs microtask queue (`Promise`, `queueMicrotask`), lexical scoping, closures, and garbage collection.",
      keyConcepts: [
        "Event Loop: Call Stack vs Microtask Queue vs Macrotask Queue",
        "Closures & Lexical Environments",
        "Prototypes & Prototypal Inheritance",
        "Async/Await, Promise combinators (`Promise.allSettled`, `Promise.any`)",
        "ES Modules (`import`/`export`, tree-shaking)",
      ],
      checklist: [
        {
          id: "chk-js-1",
          title: "Predict exact execution order of Promises, setTimeout, and microtasks",
          completed: true,
        },
        {
          id: "chk-js-2",
          title: "Write a custom debounce and throttle function with cleanup",
          completed: true,
        },
        {
          id: "chk-js-3",
          title: "Implement a deep clone function handling circular references",
          completed: true,
        },
      ],
      resources: [
        {
          id: "res-js-1",
          title: "JavaScript Info — Modern JavaScript Tutorial",
          url: "https://javascript.info/",
          type: "book",
          provider: "Ilya Kantor",
          badge: "Must Read",
          isFree: true,
        },
        {
          id: "res-js-2",
          title: "What the heck is the event loop anyway? — Philip Roberts",
          url: "https://www.youtube.com/watch?v=8aGhZQkoFbQ",
          type: "video",
          provider: "JSConf EU",
          duration: "26 min",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-fe-typescript",
        title: "TypeScript Mastery",
        slug: "typescript-types-generics",
        category: "frontend",
        level: "intermediate",
        importance: "essential",
        status: "in-progress",
        estimatedHours: 25,
        branchType: "left-branch",
        summary: "Generics, utility types, conditional types, and discriminant unions.",
        description:
          "TypeScript provides compile-time safety and self-documenting codebases. Master mapped types, infer keyword, discriminated unions, and declaration merging.",
        keyConcepts: [
          "Discriminated Unions & Exhaustive Type Checks",
          "Generics & Generic Constraints (`extends`)",
          "Conditional Types (`T extends U ? X : Y`) & `infer`",
          "Utility Types (`Omit`, `Pick`, `Record`, `Partial`, `ReturnType`)",
          "TypeScript strict mode & `noImplicitAny`",
        ],
        checklist: [
          {
            id: "chk-ts-1",
            title: "Build a type-safe EventBus or State Store with TypeScript generics",
            completed: true,
          },
          {
            id: "chk-ts-2",
            title: "Create a discriminated union representing API loading, success, and error states",
            completed: true,
          },
          {
            id: "chk-ts-3",
            title: "Implement an advanced recursive DeepReadonly utility type",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-ts-1",
            title: "Total TypeScript — Matt Pocock",
            url: "https://www.totaltypescript.com/",
            type: "course",
            provider: "Total TypeScript",
            isFree: true,
          },
          {
            id: "res-ts-2",
            title: "TypeScript Official Handbook",
            url: "https://www.typescriptlang.org/docs/handbook/intro.html",
            type: "documentation",
            provider: "Microsoft",
            isFree: true,
          },
        ],
      },
      {
        id: "node-fe-web-apis",
        title: "Browser Web APIs & Workers",
        slug: "browser-web-apis-web-workers",
        category: "frontend",
        level: "intermediate",
        importance: "recommended",
        status: "planned",
        estimatedHours: 14,
        branchType: "right-branch",
        summary: "IntersectionObserver, MutationObserver, Web Workers, and Storage APIs.",
        description:
          "Move beyond simple DOM manipulation. Utilize IntersectionObserver for virtual lists, ResizeObserver for responsive components, and Web Workers for background computations.",
        keyConcepts: [
          "IntersectionObserver & Lazy Loading",
          "Web Workers & Off-Main-Thread Processing",
          "IndexedDB & CacheStorage",
          "BroadcastChannel & WebSockets",
        ],
        checklist: [
          {
            id: "chk-api-1",
            title: "Build an infinite scroll list powered by IntersectionObserver",
            completed: false,
          },
          {
            id: "chk-api-2",
            title: "Offload heavy data processing to a dedicated Web Worker",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-api-1",
            title: "Web APIs Overview on MDN",
            url: "https://developer.mozilla.org/en-US/docs/Web/API",
            type: "documentation",
            provider: "MDN",
            isFree: true,
          },
        ],
      },
    ],
  },
  {
    id: "stage-fe-5",
    stageNumber: 5,
    title: "Modern Framework: React & Next.js",
    subtitle: "Component architecture, Server Components, and routing",
    category: "frontend",
    trunkNode: {
      id: "node-fe-react",
      title: "React 19 & Component Architecture",
      slug: "react-19-component-architecture",
      category: "frontend",
      level: "intermediate",
      importance: "essential",
      status: "in-progress",
      estimatedHours: 40,
      badge: "Industry Standard",
      summary: "Virtual DOM reconciliation, hooks lifecycle, Concurrent Mode, and React Compiler.",
      description:
        "React remains the dominant frontend library. Master hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useTransition`, `useOptimistic`), rules of hooks, context optimization, and custom hooks abstraction.",
      keyConcepts: [
        "Fiber Architecture & Reconciliation",
        "Rules of Hooks & Closures inside Effects",
        "React 19 Actions & `useActionState`",
        "`useTransition` & Non-blocking rendering",
        "Custom Hooks for Reusable Business Logic",
      ],
      checklist: [
        {
          id: "chk-react-1",
          title: "Build a resilient custom hook (`useDebounce`, `useLocalStorage`)",
          completed: true,
        },
        {
          id: "chk-react-2",
          title: "Prevent unnecessary re-renders using proper state colocation and memoization",
          completed: true,
        },
        {
          id: "chk-react-3",
          title: "Implement non-urgent search filtering with `useTransition` for 60fps typing",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-react-1",
          title: "React.dev — The New Official React Documentation",
          url: "https://react.dev/",
          type: "documentation",
          provider: "React Core Team",
          badge: "Official",
          isFree: true,
        },
        {
          id: "res-react-2",
          title: "Epic React — Kent C. Dodds",
          url: "https://epicreact.dev/",
          type: "course",
          provider: "Kent C. Dodds",
          isFree: false,
        },
      ],
    },
    branches: [
      {
        id: "node-fe-nextjs",
        title: "Next.js App Router (RSC)",
        slug: "nextjs-app-router-server-components",
        category: "frontend",
        level: "advanced",
        importance: "essential",
        status: "in-progress",
        estimatedHours: 30,
        branchType: "left-branch",
        summary: "React Server Components, Server Actions, streaming SSR, and edge caching.",
        description:
          "Next.js App Router unifies client and server. Render heavy components on the server without shipping JavaScript bundles to the browser, stream HTML with Suspense, and mutate state with Server Actions.",
        keyConcepts: [
          "React Server Components (RSC) vs Client Components",
          "Streaming with Suspense & loading.tsx",
          "Server Actions & Form Optimistic Updates",
          "Incremental Static Regeneration (ISR) & Route Handlers",
        ],
        checklist: [
          {
            id: "chk-next-1",
            title: "Build dynamic and static routes with metadata generation",
            completed: true,
          },
          {
            id: "chk-next-2",
            title: "Implement streaming UI with Suspense boundaries around slow data fetches",
            completed: false,
          },
          {
            id: "chk-next-3",
            title: "Create authenticated Server Actions with input validation (Zod)",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-next-1",
            title: "Next.js Official Documentation & Learn Course",
            url: "https://nextjs.org/docs",
            type: "documentation",
            provider: "Vercel",
            badge: "Official",
            isFree: true,
          },
        ],
      },
      {
        id: "node-fe-alternatives",
        title: "Vue / Nuxt & Svelte Alternatives",
        slug: "vue-svelte-alternative-frameworks",
        category: "frontend",
        level: "intermediate",
        importance: "optional",
        status: "planned",
        estimatedHours: 15,
        branchType: "right-branch",
        summary: "Signals-based reactivity in Svelte 5 and Vue 3 Composition API.",
        description:
          "Understanding how Vue and Svelte approach fine-grained reactivity and compiling components without a virtual DOM deepens your mental model of web frameworks.",
        keyConcepts: [
          "Fine-grained Reactive Signals",
          "Vue 3 Composition API & `ref`/`computed`",
          "Svelte 5 Runes (`$state`, `$derived`, `$effect`)",
        ],
        checklist: [
          {
            id: "chk-alt-1",
            title: "Compare fine-grained reactivity vs React virtual DOM reconciliation",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-alt-1",
            title: "Svelte 5 Documentation & Tutorial",
            url: "https://svelte.dev/docs/svelte/overview",
            type: "documentation",
            provider: "Svelte Team",
            isFree: true,
          },
        ],
      },
    ],
  },
  {
    id: "stage-fe-6",
    stageNumber: 6,
    title: "State Management & Data Layer",
    subtitle: "Client stores, server caches, and optimistic mutations",
    category: "frontend",
    trunkNode: {
      id: "node-fe-state-strategy",
      title: "State Architecture (Server vs Client)",
      slug: "state-architecture-server-vs-client",
      category: "frontend",
      level: "intermediate",
      importance: "essential",
      status: "in-progress",
      estimatedHours: 20,
      badge: "Architecture",
      summary: "Stop putting server cache into Redux: separate async remote state from local ephemeral state.",
      description:
        "Modern frontend architectures cleanly bifurcate state: Server State (remote, asynchronous, cache invalidation, deduplication) belongs in TanStack Query / SWR / RSC; UI State (modals, active tabs, client filters) belongs in Zustand / Context.",
      keyConcepts: [
        "Server Cache vs Client Ephemeral State",
        "Cache Keys, Stale Times, and Garbage Collection",
        "Optimistic UI Updates with Rollback",
        "URL Query Params as Single Source of Truth for Filters",
      ],
      checklist: [
        {
          id: "chk-state-1",
          title: "Store filters and pagination state in URL search parameters",
          completed: true,
        },
        {
          id: "chk-state-2",
          title: "Setup TanStack Query for automatic deduplication and background revalidation",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-state-1",
          title: "Practical React Query — TkDodo's Blog",
          url: "https://tkdodo.eu/blog/practical-react-query",
          type: "article",
          provider: "TkDodo",
          badge: "Must Read",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-fe-tanstack-query",
        title: "TanStack Query (React Query)",
        slug: "tanstack-query-data-fetching",
        category: "frontend",
        level: "advanced",
        importance: "essential",
        status: "in-progress",
        estimatedHours: 15,
        branchType: "left-branch",
        summary: "Declarative async data fetching, pagination, and mutations.",
        description:
          "TanStack Query is the de-facto asynchronous data synchronizer for React. Learn queries, mutations, query invalidation, prefetching, and infinite queries.",
        keyConcepts: [
          "`useQuery` and `useMutation`",
          "`queryClient.invalidateQueries` & Refetching",
          "Optimistic Updates using `onMutate` and `onError`",
          "Infinite Scroll with `useInfiniteQuery`",
        ],
        checklist: [
          {
            id: "chk-tq-1",
            title: "Implement an optimistic like/bookmark toggle with rollback on network failure",
            completed: false,
          },
          {
            id: "chk-tq-2",
            title: "Configure prefetching on link hover for instant page loads",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-tq-1",
            title: "TanStack Query v5 Docs",
            url: "https://tanstack.com/query/latest/docs/framework/react/overview",
            type: "documentation",
            provider: "TanStack",
            isFree: true,
          },
        ],
      },
      {
        id: "node-fe-zustand",
        title: "Zustand & Minimal Client Stores",
        slug: "zustand-client-state-stores",
        category: "frontend",
        level: "intermediate",
        importance: "recommended",
        status: "completed",
        estimatedHours: 10,
        branchType: "right-branch",
        summary: "Boilerplate-free client state with selectors and middleware.",
        description:
          "Zustand provides a tiny, fast, unopinionated state management solution using simplified flux principles. It avoids context re-rendering pitfalls via fine-grained state selectors.",
        keyConcepts: [
          "Store creation and atomic selectors",
          "`persist` middleware with localStorage / IndexedDB",
          "`devtools` middleware for Redux DevTools debugging",
        ],
        checklist: [
          {
            id: "chk-zu-1",
            title: "Build a global cart or notification store with Zustand and selectors",
            completed: true,
          },
        ],
        resources: [
          {
            id: "res-zu-1",
            title: "Zustand Official Documentation & Examples",
            url: "https://zustand.docs.pmnd.rs/",
            type: "documentation",
            provider: "Poimandres",
            isFree: true,
          },
        ],
      },
    ],
  },
  {
    id: "stage-fe-7",
    stageNumber: 7,
    title: "Web Performance & Core Web Vitals",
    subtitle: "Sub-second load times, smooth interaction, and visual stability",
    category: "frontend",
    trunkNode: {
      id: "node-fe-perf-vitals",
      title: "Core Web Vitals & Real User Monitoring",
      slug: "core-web-vitals-rum-optimization",
      category: "frontend",
      level: "advanced",
      importance: "essential",
      status: "planned",
      estimatedHours: 25,
      badge: "High Impact",
      summary: "Optimize LCP (Largest Contentful Paint), INP (Interaction to Next Paint), and CLS (Cumulative Layout Shift).",
      description:
        "Google uses Core Web Vitals directly for search ranking and user experience evaluation. Learn how to debug long animation frames (LoAF), layout shifts caused by un-dimensioned media, and font loading flashes.",
      keyConcepts: [
        "Largest Contentful Paint (LCP) < 2.5s",
        "Interaction to Next Paint (INP) < 200ms",
        "Cumulative Layout Shift (CLS) < 0.1",
        "Long Tasks & Yielding to Main Thread (`scheduler.yield()`)",
        "Font display: swap & preloading critical fonts",
      ],
      checklist: [
        {
          id: "chk-perf-1",
          title: "Achieve green Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1) on mobile",
          completed: false,
        },
        {
          id: "chk-perf-2",
          title: "Profile Long Animation Frames (LoAF) and yield work using `scheduler.yield()`",
          completed: false,
        },
        {
          id: "chk-perf-3",
          title: "Eliminate CLS by specifying explicit aspect-ratios on images and embed elements",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-perf-1",
          title: "web.dev — Google Core Web Vitals Guide",
          url: "https://web.dev/vitals/",
          type: "documentation",
          provider: "Google Chrome",
          badge: "Essential",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-fe-bundle-opt",
        title: "Code Splitting & Bundle Analyzer",
        slug: "code-splitting-bundle-optimization",
        category: "frontend",
        level: "advanced",
        importance: "recommended",
        status: "planned",
        estimatedHours: 12,
        branchType: "left-branch",
        summary: "Dynamic imports, tree-shaking, and external dependencies pruning.",
        description:
          "Audit JavaScript bundle sizes using `@next/bundle-analyzer` or `webpack-bundle-analyzer`. Replace heavy libraries (Moment.js -> date-fns/Temporal, Lodash -> native methods).",
        keyConcepts: [
          "Dynamic `import()` & React.lazy",
          "Tree-shaking ES Modules",
          "Bundle Visualization & Chunk Splitting",
        ],
        checklist: [
          {
            id: "chk-bund-1",
            title: "Audit package bundle size and replace heavy dependencies",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-bund-1",
            title: "Bundlephobia: Find the cost of adding a npm package",
            url: "https://bundlephobia.com/",
            type: "article",
            provider: "Bundlephobia",
            isFree: true,
          },
        ],
      },
    ],
  },
  {
    id: "stage-fe-8",
    stageNumber: 8,
    title: "Testing, CI/CD & Deployment",
    subtitle: "Automated test suites, pipelines, and production edge deployment",
    category: "frontend",
    trunkNode: {
      id: "node-fe-testing",
      title: "Testing Trophy: Vitest, RTL & Playwright",
      slug: "testing-vitest-react-testing-library-playwright",
      category: "frontend",
      level: "advanced",
      importance: "essential",
      status: "planned",
      estimatedHours: 30,
      badge: "Quality",
      summary: "Write maintainable unit, component, and end-to-end tests without mocking the entire world.",
      description:
        "Adopt Kent C. Dodds' Testing Trophy philosophy: emphasize integration and component testing. Test user behavior rather than implementation details using React Testing Library and Playwright.",
      keyConcepts: [
        "Unit Testing with Vitest",
        "React Testing Library: queries by accessible role (`getByRole`)",
        "Mock Service Worker (MSW) for API interception",
        "End-to-End browser testing with Playwright",
      ],
      checklist: [
        {
          id: "chk-test-1",
          title: "Write component tests using `getByRole` without test IDs",
          completed: false,
        },
        {
          id: "chk-test-2",
          title: "Mock network requests at the network layer using MSW",
          completed: false,
        },
        {
          id: "chk-test-3",
          title: "Setup an automated Playwright E2E smoke test in GitHub Actions",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-test-1",
          title: "Testing JavaScript — Kent C. Dodds",
          url: "https://testingjavascript.com/",
          type: "course",
          provider: "Kent C. Dodds",
          isFree: false,
        },
        {
          id: "res-test-2",
          title: "Playwright Documentation",
          url: "https://playwright.dev/docs/intro",
          type: "documentation",
          provider: "Microsoft",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-fe-cicd",
        title: "GitHub Actions & Cloud Edge Deploy",
        slug: "github-actions-edge-deployment",
        category: "frontend",
        level: "intermediate",
        importance: "essential",
        status: "planned",
        estimatedHours: 14,
        branchType: "right-branch",
        summary: "Linting, automated PR previews, and zero-downtime edge distribution.",
        description:
          "Continuous Integration verifies code formatting, TypeScript types, and tests on every commit. Deploy globally to CDN edges (Vercel, Cloudflare Pages, AWS CloudFront).",
        keyConcepts: [
          "GitHub Actions Workflow YAML",
          "Automated Preview Deployments",
          "Edge Functions & Cloudflare Workers",
        ],
        checklist: [
          {
            id: "chk-ci-1",
            title: "Build a GitHub Actions workflow that runs lint, typecheck, and tests on PRs",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-ci-1",
            title: "GitHub Actions Documentation",
            url: "https://docs.github.com/en/actions",
            type: "documentation",
            provider: "GitHub",
            isFree: true,
          },
        ],
      },
    ],
  },
];

// Backend Roadmap Tiers
const backendTiers: RoadmapTier[] = [
  {
    id: "stage-be-1",
    stageNumber: 1,
    title: "Backend Foundations & Runtimes",
    subtitle: "Runtimes, asynchronous I/O, and server architectures",
    category: "backend",
    trunkNode: {
      id: "node-be-runtime",
      title: "Node.js Event Loop, Rust & Go Runtimes",
      slug: "backend-runtimes-event-loop-concurrency",
      category: "backend",
      level: "fundamental",
      importance: "essential",
      status: "completed",
      estimatedHours: 25,
      badge: "Crucial",
      summary: "Non-blocking I/O, threads vs worker pools, and memory management.",
      description:
        "Understand asynchronous non-blocking I/O architectures (libuv in Node.js, Tokio in Rust, Goroutines in Go). Learn when to leverage thread pools vs single-threaded event loops.",
      keyConcepts: [
        "Non-blocking I/O & epoll/kqueue",
        "Node.js Event Loop Phases (Timers, Poll, Check, Close)",
        "Rust Tokio & Async Concurrency",
        "Go Goroutines & Channels",
      ],
      checklist: [
        {
          id: "chk-be-1",
          title: "Build an asynchronous HTTP server handling 10,000 req/sec",
          completed: true,
        },
        {
          id: "chk-be-2",
          title: "Debug high CPU usage blocking the Node.js event loop",
          completed: true,
        },
      ],
      resources: [
        {
          id: "res-be-1",
          title: "Node.js Event Loop Architecture Guide",
          url: "https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick",
          type: "documentation",
          provider: "Node.js",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-be-os-linux",
        title: "Linux & Terminal Mastery",
        slug: "linux-processes-and-networking",
        category: "backend",
        level: "fundamental",
        importance: "essential",
        status: "completed",
        estimatedHours: 15,
        branchType: "left-branch",
        summary: "File permissions, processes, sockets, systemd, and cron.",
        description: "Nearly all production backends run on Linux. Master bash, grep, curl, htop, systemd service management, and POSIX signals.",
        keyConcepts: ["Process management (`ps`, `kill`, `top`)", "Systemd service daemons", "SSH key authentication & firewalls (ufw)"],
        checklist: [
          { id: "chk-linux-1", title: "Write a systemd unit file with automatic restart on crash", completed: true },
        ],
        resources: [
          { id: "res-lin-1", title: "The Linux Command Line — William Shotts", url: "https://linuxcommand.org/", type: "book", isFree: true },
        ],
      },
    ],
  },
  {
    id: "stage-be-2",
    stageNumber: 2,
    title: "Databases & Storage Engines",
    subtitle: "Relational modeling, indexing, NoSQL, and transactions",
    category: "backend",
    trunkNode: {
      id: "node-be-databases",
      title: "Relational Databases: PostgreSQL & SQL Internals",
      slug: "relational-databases-postgresql-sql-internals",
      category: "backend",
      level: "fundamental",
      importance: "essential",
      status: "in-progress",
      estimatedHours: 35,
      badge: "Core",
      summary: "ACID guarantees, B-tree indexes, query planners, and schema normalization.",
      description:
        "PostgreSQL is the workhorse of modern software. Master normalization (3NF), complex joins, subqueries, transaction isolation levels (Read Committed, Repeatable Read, Serializable), and indexing strategies.",
      keyConcepts: [
        "ACID Guarantees & WAL (Write-Ahead Logging)",
        "B-Tree, GIN, and GiST Indexes",
        "`EXPLAIN ANALYZE` and Query Cost Optimization",
        "Transactions & Row Locking (`SELECT FOR UPDATE`)",
        "Connection Pooling (PgBouncer)",
      ],
      checklist: [
        {
          id: "chk-db-1",
          title: "Analyze a slow query using `EXPLAIN (ANALYZE, BUFFERS)` and eliminate Seq Scans",
          completed: true,
        },
        {
          id: "chk-db-2",
          title: "Implement database migrations without locking tables in production",
          completed: false,
        },
        {
          id: "chk-db-3",
          title: "Configure PgBouncer connection pooling to avoid PostgreSQL connection exhaustion",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-db-1",
          title: "Use The Index, Luke! — SQL Indexing Guide",
          url: "https://use-the-index-luke.com/",
          type: "book",
          provider: "Markus Winand",
          badge: "Must Read",
          isFree: true,
        },
        {
          id: "res-db-2",
          title: "Designing Data-Intensive Applications",
          url: "https://dataintensive.net/",
          type: "book",
          provider: "Martin Kleppmann",
          badge: "Gold Standard",
          isFree: false,
        },
      ],
    },
    branches: [
      {
        id: "node-be-redis",
        title: "Redis In-Memory Caching",
        slug: "redis-caching-and-data-structures",
        category: "backend",
        level: "intermediate",
        importance: "essential",
        status: "in-progress",
        estimatedHours: 18,
        branchType: "left-branch",
        summary: "Key-value caching, Pub/Sub, Redis Streams, rate limiting, and distributed locks.",
        description:
          "Redis powers ultra-fast cache layers, distributed session storage, leaderboards (Sorted Sets), rate limiting token buckets, and distributed Redlock algorithms.",
        keyConcepts: [
          "Redis Data Structures (Hashes, Sets, Sorted Sets, Bitmaps)",
          "Cache Invalidation Patterns (Cache-Aside, Write-Through)",
          "Rate Limiting with Sliding Window in Redis",
          "Distributed Locks & Redlock",
        ],
        checklist: [
          {
            id: "chk-red-1",
            title: "Implement a sliding window rate limiter using Redis sorted sets (ZSET)",
            completed: true,
          },
          {
            id: "chk-red-2",
            title: "Prevent cache thundering herds using single-flight mutexes or probabilistic early expiration",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-red-1",
            title: "Redis Documentation & Architecture",
            url: "https://redis.io/docs/latest/",
            type: "documentation",
            provider: "Redis",
            isFree: true,
          },
        ],
      },
      {
        id: "node-be-nosql",
        title: "NoSQL & Document Stores: MongoDB & Cassandra",
        slug: "nosql-mongodb-cassandra-wide-column",
        category: "backend",
        level: "intermediate",
        importance: "recommended",
        status: "planned",
        estimatedHours: 15,
        branchType: "right-branch",
        summary: "CAP theorem, eventual consistency, and document schema design.",
        description:
          "Learn when to use document stores (MongoDB) or wide-column stores (Apache Cassandra) for high write-throughput and horizontal partitioning.",
        keyConcepts: ["CAP Theorem & PACELC", "Document embedding vs referencing", "Sharding keys and replica sets"],
        checklist: [
          { id: "chk-nosql-1", title: "Design a high-throughput time-series schema in MongoDB", completed: false },
        ],
        resources: [
          { id: "res-no-1", title: "MongoDB University Courses", url: "https://learn.mongodb.com/", type: "course", isFree: true },
        ],
      },
    ],
  },
  {
    id: "stage-be-3",
    stageNumber: 3,
    title: "APIs & Communication Protocols",
    subtitle: "REST, GraphQL, gRPC, WebSockets, and message brokers",
    category: "backend",
    trunkNode: {
      id: "node-be-api-protocols",
      title: "API Design: REST, gRPC & WebSockets",
      slug: "api-design-rest-grpc-websockets",
      category: "backend",
      level: "intermediate",
      importance: "essential",
      status: "in-progress",
      estimatedHours: 30,
      badge: "Core",
      summary: "Richardson maturity model, Protocol Buffers, bidirectional streams, and OpenAPI 3.1.",
      description:
        "Build scalable communication layers. Use REST and OpenAPI for external client integration, gRPC over HTTP/2 with Protobuf for high-speed inter-service microservice communication, and WebSockets for real-time bidirectional messaging.",
      keyConcepts: [
        "OpenAPI Specification & Swagger Documentation",
        "Protocol Buffers (Protobuf) & gRPC Services",
        "WebSocket Handshake & Frame Protocol",
        "API Versioning Strategies (URI vs Header)",
      ],
      checklist: [
        {
          id: "chk-api-p-1",
          title: "Define a clean gRPC service with Protocol Buffers and generate TypeScript types",
          completed: true,
        },
        {
          id: "chk-api-p-2",
          title: "Implement heartbeat ping/pong on WebSocket connections to detect dropped clients",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-grpc-1",
          title: "gRPC Official Documentation & Guides",
          url: "https://grpc.io/docs/",
          type: "documentation",
          provider: "CNCF",
          isFree: true,
        },
      ],
    },
    branches: [
      {
        id: "node-be-kafka",
        title: "Message Brokers: Kafka & RabbitMQ",
        slug: "message-brokers-kafka-rabbitmq-event-driven",
        category: "backend",
        level: "advanced",
        importance: "essential",
        status: "planned",
        estimatedHours: 25,
        branchType: "left-branch",
        summary: "Event-driven architecture, consumer groups, partitions, and dead letter queues.",
        description:
          "Decouple backend microservices with asynchronous messaging. Understand RabbitMQ AMQP exchange routing vs Apache Kafka partitioned commit logs.",
        keyConcepts: [
          "Event-Driven Architecture",
          "Kafka Partitions, Offsets & Consumer Groups",
          "At-least-once vs Exactly-once Delivery",
          "Dead Letter Queues (DLQ) & Poison Pill Handling",
        ],
        checklist: [
          {
            id: "chk-kfk-1",
            title: "Build an event-driven notification service reading from Kafka topic",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-kfk-1",
            title: "Apache Kafka Fundamentals",
            url: "https://developer.confluent.io/learn-kafka/",
            type: "course",
            provider: "Confluent",
            isFree: true,
          },
        ],
      },
    ],
  },
  {
    id: "stage-be-4",
    stageNumber: 4,
    title: "System Design, Microservices & Scale",
    subtitle: "Horizontal scaling, load balancing, consensus, and resilience",
    category: "backend",
    trunkNode: {
      id: "node-be-system-design",
      title: "System Design & Distributed Systems",
      slug: "system-design-distributed-systems-scale",
      category: "backend",
      level: "advanced",
      importance: "essential",
      status: "planned",
      estimatedHours: 45,
      badge: "Architect Level",
      summary: "Load balancers, consistent hashing, database replication, and circuit breakers.",
      description:
        "Learn how systems scale from 1 to 100 million users. Master consistent hashing, reverse proxies (Nginx, Envoy), database master-replica failovers, circuit breakers, and distributed tracing.",
      keyConcepts: [
        "Consistent Hashing & Partitioning",
        "Circuit Breaker Pattern & Bulkhead Isolation",
        "Distributed Tracing with OpenTelemetry",
        "CQRS (Command Query Responsibility Segregation)",
      ],
      checklist: [
        {
          id: "chk-sd-1",
          title: "Design a URL shortener or Twitter feed system handling 100k writes/sec",
          completed: false,
        },
        {
          id: "chk-sd-2",
          title: "Implement distributed tracing with OpenTelemetry and Jaeger",
          completed: false,
        },
      ],
      resources: [
        {
          id: "res-sd-1",
          title: "The System Design Primer — Donne Martin",
          url: "https://github.com/donnemartin/system-design-primer",
          type: "github",
          provider: "GitHub",
          badge: "Legendary",
          isFree: true,
        },
        {
          id: "res-sd-2",
          title: "ByteByteGo — Alex Xu System Design",
          url: "https://bytebytego.com/",
          type: "course",
          provider: "ByteByteGo",
          isFree: false,
        },
      ],
    },
    branches: [
      {
        id: "node-be-security",
        title: "Authentication, OAuth2 & OWASP",
        slug: "backend-security-oauth2-jwt-owasp",
        category: "backend",
        level: "advanced",
        importance: "essential",
        status: "planned",
        estimatedHours: 20,
        branchType: "right-branch",
        summary: "OAuth 2.1 authorization code flow, PKCE, JWT validation, and OWASP Top 10 mitigation.",
        description:
          "Secure user data and services against SQL injection, CSRF, SSRF, broken object-level authorization (BOLA), and timing attacks.",
        keyConcepts: [
          "OAuth 2.1 & OIDC (OpenID Connect)",
          "JWT Signing & Asymmetric Public Key Verification (JWKS)",
          "OWASP Top 10 API Security",
          "Argon2id & Bcrypt Password Hashing",
        ],
        checklist: [
          {
            id: "chk-sec-1",
            title: "Implement OAuth2 with PKCE and rotating refresh tokens",
            completed: false,
          },
        ],
        resources: [
          {
            id: "res-sec-1",
            title: "OWASP API Security Top 10",
            url: "https://owasp.org/www-project-api-security/",
            type: "documentation",
            provider: "OWASP",
            isFree: true,
          },
        ],
      },
    ],
  },
];

// DevOps Roadmap Tiers
const devopsTiers: RoadmapTier[] = [
  {
    id: "stage-do-1",
    stageNumber: 1,
    title: "Containers & Orchestration",
    subtitle: "Docker image optimization and Kubernetes clusters",
    category: "devops",
    trunkNode: {
      id: "node-do-docker",
      title: "Docker & Container Architecture",
      slug: "docker-container-architecture-cgroups",
      category: "devops",
      level: "fundamental",
      importance: "essential",
      status: "completed",
      estimatedHours: 20,
      badge: "Core",
      summary: "Linux namespaces, cgroups, multi-stage Dockerfiles, and rootless containers.",
      description:
        "Containers encapsulate applications and their dependencies. Master multi-stage Docker builds to reduce image sizes to <50MB, understand container security scanning, and dive into how Linux cgroups enforce CPU and memory boundaries.",
      keyConcepts: ["Linux Namespaces & Control Groups (cgroups)", "Multi-Stage Dockerfile Optimization", "Image Scanning with Trivy", "Docker Compose for Local Microservices"],
      checklist: [
        { id: "chk-doc-1", title: "Write a multi-stage Dockerfile producing an Alpine/Distroless image under 50MB", completed: true },
        { id: "chk-doc-2", title: "Run containers under unprivileged non-root user IDs", completed: true },
      ],
      resources: [
        { id: "res-doc-1", title: "Docker Official Best Practices Guide", url: "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/", type: "documentation", isFree: true },
      ],
    },
    branches: [
      {
        id: "node-do-k8s",
        title: "Kubernetes (K8s) Cluster Mastery",
        slug: "kubernetes-pods-services-ingress-helm",
        category: "devops",
        level: "advanced",
        importance: "essential",
        status: "in-progress",
        estimatedHours: 40,
        branchType: "left-branch",
        summary: "Pods, Deployments, Services, Ingress controllers, Helm charts, and HPA autoscaling.",
        description:
          "Kubernetes orchestrates container fleets at scale. Learn Pod lifecycles, liveness/readiness probes, Horizontal Pod Autoscalers (HPA), and declarative Helm package manifests.",
        keyConcepts: ["K8s Control Plane (API Server, etcd, Kubelet)", "Deployments, Services & Ingress Routes", "Horizontal Pod Autoscaler (HPA)", "Helm Charts & Kustomize"],
        checklist: [
          { id: "chk-k8s-1", title: "Deploy a resilient microservice with rolling updates and zero downtime", completed: true },
          { id: "chk-k8s-2", title: "Configure HPA to scale pods based on custom CPU/memory thresholds", completed: false },
        ],
        resources: [
          { id: "res-k8s-1", title: "Kubernetes The Hard Way — Kelsey Hightower", url: "https://github.com/kelseyhightower/kubernetes-the-hard-way", type: "github", isFree: true },
        ],
      },
    ],
  },
  {
    id: "stage-do-2",
    stageNumber: 2,
    title: "Infrastructure as Code (IaC) & Cloud",
    subtitle: "Terraform, AWS/GCP, and immutable infrastructure",
    category: "devops",
    trunkNode: {
      id: "node-do-terraform",
      title: "Terraform & Cloud Architecture (AWS/GCP)",
      slug: "terraform-infrastructure-as-code-aws",
      category: "devops",
      level: "advanced",
      importance: "essential",
      status: "in-progress",
      estimatedHours: 35,
      badge: "Enterprise",
      summary: "HCL, remote state locking with S3 + DynamoDB, reusable modules, and VPC networking.",
      description:
        "Manage cloud infrastructure declaratively. Master Terraform state locks, module composition, provider authentication, and secure VPC subnet provisioning on AWS.",
      keyConcepts: ["Terraform HCL Syntax & Modules", "Remote State Backend & Locking", "AWS VPC, Subnets, Internet Gateways & IAM", "Drift Detection & `terraform plan`"],
      checklist: [
        { id: "chk-tf-1", title: "Provision an automated multi-AZ VPC with public and private subnets via Terraform", completed: true },
        { id: "chk-tf-2", title: "Lock remote state using AWS S3 and DynamoDB table", completed: false },
      ],
      resources: [
        { id: "res-tf-1", title: "Terraform: Up & Running — Yevgeniy Brikman", url: "https://www.terraformupandrunning.com/", type: "book", isFree: false },
      ],
    },
    branches: [
      {
        id: "node-do-observability",
        title: "Observability: Prometheus, Grafana & Loki",
        slug: "prometheus-metrics-grafana-dashboards",
        category: "devops",
        level: "advanced",
        importance: "essential",
        status: "planned",
        estimatedHours: 25,
        branchType: "right-branch",
        summary: "Metric scraping, PromQL queries, SLO/SLA alerts, and distributed logging.",
        description:
          "Instrument infrastructure with Prometheus push/pull metrics, craft Grafana executive dashboards, and set PagerDuty alert triggers on error budget burns.",
        keyConcepts: ["PromQL Queries & Histogram Percentiles (p95, p99)", "Grafana Dashboard Panels", "Alertmanager Rules & PagerDuty integration"],
        checklist: [
          { id: "chk-obs-1", title: "Build a Grafana dashboard monitoring p99 latency and error rates", completed: false },
        ],
        resources: [
          { id: "res-obs-1", title: "Google SRE Book — Monitoring Distributed Systems", url: "https://sre.google/sre-book/monitoring-distributed-systems/", type: "book", isFree: true },
        ],
      },
    ],
  },
];

// Helper to extract all nodes flat
function flattenTiers(tiers: RoadmapTier[]): RoadmapNode[] {
  const list: RoadmapNode[] = [];
  for (const tier of tiers) {
    list.push(tier.trunkNode);
    if (tier.branches) {
      for (const branch of tier.branches) {
        list.push(branch);
        if (branch.branches) {
          list.push(...branch.branches);
        }
      }
    }
  }
  return list;
}

const allFrontendNodes = flattenTiers(frontendTiers);
const allBackendNodes = flattenTiers(backendTiers);
const allDevopsNodes = flattenTiers(devopsTiers);

const categoriesConfig = [
  {
    id: "frontend" as TechCategory,
    label: "Frontend Engineering",
    description: "Modern JavaScript, React 19, Next.js App Router, CSS Systems, and Core Web Vitals",
    icon: "FE",
    count: allFrontendNodes.length,
    accentColor: "var(--color-info)",
  },
  {
    id: "backend" as TechCategory,
    label: "Backend & Systems",
    description: "Distributed Systems, High-Concurrency Runtimes, PostgreSQL, Redis, and gRPC",
    icon: "BE",
    count: allBackendNodes.length,
    accentColor: "var(--color-accent)",
  },
  {
    id: "devops" as TechCategory,
    label: "DevOps & Cloud Native",
    description: "Docker, Kubernetes, Terraform IaC, Prometheus, and Cloud Infrastructure",
    icon: "DO",
    count: allDevopsNodes.length,
    accentColor: "var(--color-success)",
  },
  {
    id: "system-design" as TechCategory,
    label: "System Design & Architecture",
    description: "Horizontal scaling, consensus algorithms, microservices, and database sharding",
    icon: "SD",
    count: 8,
    accentColor: "var(--color-accent)",
  },
  {
    id: "data-ai" as TechCategory,
    label: "AI & Machine Learning",
    description: "Python, PyTorch, Transformers, RAG Systems, MLOps, and LLM Engineering",
    icon: "AI",
    count: 12,
    accentColor: "var(--color-accent)",
  },
];

// In-memory roadmap dataset mapper
const roadmapDatastore: Record<TechCategory, { tiers: RoadmapTier[]; title: string; desc: string }> = {
  frontend: {
    tiers: frontendTiers,
    title: "Frontend Developer Roadmap 2026",
    desc: "Step-by-step roadmap to becoming a modern frontend developer. Covers internet basics, HTML/CSS, TypeScript, React 19, Next.js App Router, and Core Web Vitals.",
  },
  backend: {
    tiers: backendTiers,
    title: "Backend Developer Roadmap 2026",
    desc: "Comprehensive roadmap for backend engineers. Covers event-driven architectures, relational databases, Redis caching, microservices, and system scalability.",
  },
  devops: {
    tiers: devopsTiers,
    title: "DevOps & Cloud Engineer Roadmap",
    desc: "Master containers, Kubernetes orchestration, Terraform infrastructure as code, CI/CD pipelines, and observability at enterprise scale.",
  },
  "system-design": {
    tiers: backendTiers.filter((t) => t.stageNumber >= 3),
    title: "System Design & Distributed Systems Roadmap",
    desc: "Frameworks, trade-offs, and architectural strategies for scaling web applications to millions of concurrent users.",
  },
  "data-ai": {
    tiers: getRoadmapTrackData("data-ai").tiers,
    title: "AI & Large Language Models Roadmap",
    desc: "From mathematical foundations to PyTorch, Transformer models, fine-tuning, RAG pipelines, and autonomous AI agents.",
  },
  fullstack: {
    tiers: [...frontendTiers.slice(0, 4), ...backendTiers.slice(0, 3)],
    title: "Fullstack Web Developer Roadmap",
    desc: "Complete end-to-end fullstack curriculum bridging client-side mastery with backend scalability and database durability.",
  },
};

// =========================================================================
// REST API ROUTE HANDLER
// =========================================================================

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const searchParams = req.nextUrl.searchParams;

  const categoryParam = (searchParams.get("category") || "frontend") as TechCategory;
  const searchQuery = (searchParams.get("search") || "").toLowerCase().trim();
  const statusFilter = searchParams.get("status"); // "completed" | "in-progress" | "planned"

  const targetCategory = roadmapDatastore[categoryParam] ? categoryParam : "frontend";
  const dataset = roadmapDatastore[targetCategory];

  // Filter tiers & nodes if search or status filter is applied
  let filteredTiers = dataset.tiers;

  if (searchQuery || (statusFilter && statusFilter !== "all")) {
    filteredTiers = dataset.tiers
      .map((tier): RoadmapTier | null => {
        const matchesQuery = (node: RoadmapNode) => {
          const matchSearch =
            !searchQuery ||
            node.title.toLowerCase().includes(searchQuery) ||
            node.description.toLowerCase().includes(searchQuery) ||
            node.keyConcepts.some((c) => c.toLowerCase().includes(searchQuery));

          const matchStatus = !statusFilter || statusFilter === "all" || node.status === statusFilter;

          return matchSearch && matchStatus;
        };

        const trunkMatches = matchesQuery(tier.trunkNode);
        const filteredBranches = (tier.branches || []).filter(matchesQuery);

        if (trunkMatches || filteredBranches.length > 0) {
          return {
            ...tier,
            trunkNode: tier.trunkNode,
            branches: filteredBranches,
          };
        }
        return null;
      })
      .filter((t): t is RoadmapTier => Boolean(t));
  }

  const allFilteredNodes = flattenTiers(filteredTiers);
  const totalHours = allFilteredNodes.reduce((acc, node) => acc + (node.estimatedHours || 0), 0);

  const durationMs = Date.now() - startTime;

  const treeData: RoadmapTreeData = {
    roadmapId: `roadmap-${targetCategory}-2026`,
    title: dataset.title,
    category: targetCategory,
    description: dataset.desc,
    version: "2026.4.1-lts",
    totalEstimatedHours: totalHours,
    tiers: filteredTiers,
    allNodes: allFilteredNodes,
    categories: categoriesConfig,
    cacheMetadata: {
      cached: true,
      cacheEngine: "In-Memory Edge Cache",
      key: `roadmap:tree:${targetCategory}:v2026`,
      ttlSeconds: 86400,
      generatedMs: Math.max(1, durationMs),
      backendWorker: "CareerForge-Roadmap-Engine",
      timestamp: new Date().toISOString(),
    },
  };

  const response: RoadmapApiResponse = {
    success: true,
    data: treeData,
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Cache": "HIT",
      "X-Backend-Service": "CareerForge-Roadmap-Engine",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
