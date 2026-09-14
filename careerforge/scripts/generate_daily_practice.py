#!/usr/bin/env python3
"""
Daily Practice & Static Roadmap JSON Generator (Python Cron / Build Script)
Runs daily at 00:00 UTC to generate pre-rendered, validated JSON files.
Output path: public/data/practice/[roadmap-id]/[YYYY-MM-DD].json and latest.json
Also outputs: public/data/roadmaps/[roadmap-id].json

CDN-first, zero-runtime-DB: The browser directly fetches these static files.
"""

import os
import sys
import json
import hashlib
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

TRACKS = ["frontend", "backend", "mobile", "fullstack"]

# Sample curated questions catalog for high-signal technical tracks
QUESTIONS_CATALOG = {
    "frontend": [
        {
            "id": "fe-q1",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "JavaScript Microtasks Execution Priority",
            "question": "Given the following code, in what order are messages logged to the console?",
            "codeSnippet": 'console.log("1");\nsetTimeout(() => console.log("2"), 0);\nPromise.resolve().then(() => console.log("3"));\nconsole.log("4");',
            "options": [
                "1, 2, 3, 4",
                "1, 4, 3, 2",
                "1, 4, 2, 3",
                "1, 3, 4, 2"
            ],
            "correctOptionIndex": 1,
            "explanation": "Synchronous code runs first (`1`, then `4`). Then the microtask queue (`Promise.then`) is completely drained before macrotasks, logging `3`. Finally, the macrotask (`setTimeout`) executes, logging `2`.",
            "tags": ["JavaScript", "Event Loop", "Promises"],
            "hints": ["Remember that Promises enter the Microtask Queue, while setTimeout enters the Macrotask Queue."],
            "relatedRoadmapNodeId": "fe-node-js"
        },
        {
            "id": "fe-q2",
            "type": "code-analysis",
            "difficulty": "intermediate",
            "title": "React useCallback Dependency Equality",
            "question": "Why does the following child component still re-render when the parent updates unrelated state?",
            "codeSnippet": 'const Child = React.memo(({ onClick, style }) => {\n  return <button onClick={onClick} style={style}>Click</button>;\n});\n// In Parent:\nconst handleClick = useCallback(() => doSomething(), []);\nreturn <Child onClick={handleClick} style={{ margin: 10 }} />;',
            "options": [
                "React.memo does not work with buttons",
                "The `style={{ margin: 10 }}` inline object creates a new reference on every parent render",
                "useCallback needs doSomething in its dependency array",
                "Child components inside useCallback always re-render"
            ],
            "correctOptionIndex": 1,
            "explanation": "`React.memo` does a shallow comparison (`Object.is`) of props. Even though `onClick` maintains referential equality via `useCallback`, the `style={{ margin: 10 }}` object is allocated anew on every parent render, failing shallow equality.",
            "tags": ["React", "Performance", "Memoization"],
            "hints": ["Look closely at the `style` prop passed to Child."],
            "relatedRoadmapNodeId": "fe-node-react"
        },
        {
            "id": "fe-q3",
            "type": "multiple-choice",
            "difficulty": "beginner",
            "title": "CSS Layout Box Sizing",
            "question": "What is the total rendered width of an element with `width: 200px; padding: 20px; border: 5px solid black; box-sizing: border-box;`?",
            "options": ["250px", "200px", "225px", "240px"],
            "correctOptionIndex": 1,
            "explanation": "With `box-sizing: border-box`, the specified `width` encompasses content, padding, and borders. Therefore the total rendered width is strictly 200px.",
            "tags": ["CSS", "Box Model"],
            "hints": ["border-box subtracts padding and border from the content area."],
            "relatedRoadmapNodeId": "fe-node-css"
        },
        {
            "id": "fe-q4",
            "type": "architecture",
            "difficulty": "advanced",
            "title": "Core Web Vitals - INP Optimization",
            "question": "Which browser API is specifically recommended to yield execution back to the main thread during long-running tasks to improve Interaction to Next Paint (INP)?",
            "options": [
                "requestAnimationFrame()",
                "scheduler.yield()",
                "window.stop()",
                "document.dispatchEvent()"
            ],
            "correctOptionIndex": 1,
            "explanation": "`scheduler.yield()` is the modern web standard specifically designed to break long tasks into discrete chunks and yield to the browser's rendering queue, lowering INP delay.",
            "tags": ["Web Vitals", "Performance", "INP"],
            "hints": ["It's part of the new Prioritized Task Scheduling API."],
            "relatedRoadmapNodeId": "fe-node-perf"
        },
        {
            "id": "fe-q5",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "TypeScript Discriminated Unions",
            "question": "What makes a union type 'discriminated' in TypeScript?",
            "options": [
                "It uses the `any` keyword to bypass checking",
                "Every member in the union shares a common literal property key with distinct values",
                "It requires classes instead of interfaces",
                "It is defined inside a namespace"
            ],
            "correctOptionIndex": 1,
            "explanation": "A discriminated union features a shared singleton literal property (e.g. `type: 'success' | 'error'`) that TypeScript uses to narrow down the exact variant inside conditional blocks.",
            "tags": ["TypeScript", "Type Safety"],
            "hints": ["Think about the common 'tag' or 'kind' property."],
            "relatedRoadmapNodeId": "fe-node-ts"
        },
        {
            "id": "fe-q6",
            "type": "code-analysis",
            "difficulty": "advanced",
            "title": "Next.js Server Component Boundaries",
            "question": "Can an async React Server Component (RSC) import and render a Client Component with the 'use client' directive?",
            "options": [
                "No, Client Components cannot be rendered inside Server Components",
                "Yes, Server Components can import and render Client Components and pass serializable props",
                "Only if wrapped in an iframe",
                "Only in development mode"
            ],
            "correctOptionIndex": 1,
            "explanation": "Server Components seamlessly import and render Client Components as leaf nodes or interactive subtrees, passing serializable data as props across the network boundary.",
            "tags": ["Next.js", "RSC", "Architecture"],
            "hints": ["Server components act as the outer shell."],
            "relatedRoadmapNodeId": "fe-node-next"
        },
        {
            "id": "fe-q7",
            "type": "multiple-choice",
            "difficulty": "beginner",
            "title": "HTTP Cache-Control Directives",
            "question": "Which Cache-Control directive instructs browsers to validate cached content with the origin server before using it?",
            "options": ["no-store", "no-cache", "immutable", "public"],
            "correctOptionIndex": 1,
            "explanation": "`no-cache` does NOT mean 'do not cache'. It means the browser CAN store the response in cache, but MUST revalidate with the origin server (using ETag or If-Modified-Since) before serving it.",
            "tags": ["HTTP", "Networking", "Caching"],
            "hints": ["Contrast no-cache with no-store."],
            "relatedRoadmapNodeId": "fe-node-internet"
        },
        {
            "id": "fe-q8",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Web Accessibility (A11y)",
            "question": "What is the primary role of the `aria-live='polite'` attribute?",
            "options": [
                "It disables keyboard tab focusing",
                "It instructs screen readers to announce dynamic content updates when the user is idle",
                "It forces high contrast mode",
                "It hides the element from screen readers completely"
            ],
            "correctOptionIndex": 1,
            "explanation": "`aria-live='polite'` notifies assistive technology to queue and announce DOM mutations when the screen reader finishes speaking the current utterance, avoiding rude interruptions.",
            "tags": ["A11y", "HTML", "Accessibility"],
            "hints": ["Contrast 'polite' with 'assertive'."],
            "relatedRoadmapNodeId": "fe-node-html"
        },
        {
            "id": "fe-q9",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "State Architecture: TanStack Query",
            "question": "In TanStack Query, what does `staleTime: 5000` mean?",
            "options": [
                "The query will be deleted from cache after 5 seconds",
                "Data is considered fresh for 5 seconds; background refetches won't trigger on window focus during this window",
                "Requests will timeout after 5 seconds",
                "The browser caches the HTTP response for 5000 seconds"
            ],
            "correctOptionIndex": 1,
            "explanation": "`staleTime` dictates how long data remains fresh. While fresh, queries read directly from cache without initiating network revalidations on component mounts or window focuses.",
            "tags": ["React Query", "State Management"],
            "hints": ["Compare staleTime with gcTime (garbage collection time)."],
            "relatedRoadmapNodeId": "fe-node-state"
        },
        {
            "id": "fe-q10",
            "type": "architecture",
            "difficulty": "advanced",
            "title": "Preventing Cumulative Layout Shift (CLS)",
            "question": "What is the most effective CSS technique to prevent CLS when loading dynamic remote images?",
            "options": [
                "Setting `display: none` until loaded",
                "Specifying explicit `width` and `height` attributes or CSS `aspect-ratio` on image containers",
                "Using SVG filters",
                "Wrapping images in `<div>` with `overflow: scroll`"
            ],
            "correctOptionIndex": 1,
            "explanation": "By declaring `aspect-ratio` or explicit dimensions, the browser calculates layout space before the image binary downloads, preventing layout shifts.",
            "tags": ["CSS", "Web Vitals", "CLS"],
            "hints": ["The browser needs to reserve space upfront."],
            "relatedRoadmapNodeId": "fe-node-css"
        }
    ],
    "backend": [
        {
            "id": "be-q1",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "PostgreSQL Index Types",
            "question": "Which index type in PostgreSQL is best suited for full-text search and JSONB arrays?",
            "options": ["B-Tree", "GIN (Generalized Inverted Index)", "Hash", "BRIN"],
            "correctOptionIndex": 1,
            "explanation": "GIN (Generalized Inverted Index) is designed for composite values where elements need to be indexed individually, making it ideal for JSONB and text arrays.",
            "tags": ["PostgreSQL", "Database", "Indexing"],
            "hints": ["It inverts keys to match multiple occurrences."],
            "relatedRoadmapNodeId": "be-node-db"
        },
        {
            "id": "be-q2",
            "type": "code-analysis",
            "difficulty": "advanced",
            "title": "Redis Distributed Lock (Redlock)",
            "question": "Why must a Redis lock key have an expiration TTL?",
            "options": [
                "Redis will crash if keys lack TTL",
                "To prevent deadlocks if the acquiring worker process crashes before releasing the lock",
                "Because Redis requires TTL for all string keys",
                "To speed up memory retrieval"
            ],
            "correctOptionIndex": 1,
            "explanation": "If a service crashes while holding a lock without a TTL, no other process can ever acquire the lock, causing a permanent distributed deadlock.",
            "tags": ["Redis", "Distributed Systems", "Concurrency"],
            "hints": ["What happens if the client abruptly dies?"],
            "relatedRoadmapNodeId": "be-node-redis"
        },
        {
            "id": "be-q3",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "REST Idempotency",
            "question": "Which HTTP method is considered idempotent?",
            "options": ["POST", "PUT", "PATCH", "CONNECT"],
            "correctOptionIndex": 1,
            "explanation": "`PUT` replaces the entire target resource state. Sending the same PUT request 10 times results in the identical resource state as sending it once, satisfying idempotency.",
            "tags": ["HTTP", "REST", "API Design"],
            "hints": ["Contrast PUT with POST."],
            "relatedRoadmapNodeId": "be-node-api"
        },
        {
            "id": "be-q4",
            "type": "architecture",
            "difficulty": "advanced",
            "title": "Kafka Partitioning & Ordering",
            "question": "In Apache Kafka, what is the guarantee regarding message ordering?",
            "options": [
                "Total global ordering across all topics and partitions",
                "Strict ordering is only guaranteed within a single partition",
                "Kafka provides no ordering guarantees",
                "Messages are ordered alphabetically by key"
            ],
            "correctOptionIndex": 1,
            "explanation": "Kafka preserves total chronological order exclusively within an individual partition. If cross-partition ordering is needed, messages must share the identical partition key.",
            "tags": ["Kafka", "Message Queues", "Streaming"],
            "hints": ["Partitions are independent commit logs."],
            "relatedRoadmapNodeId": "be-node-kafka"
        },
        {
            "id": "be-q5",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Database Transaction Isolation",
            "question": "Which isolation level prevents Dirty Reads and Non-Repeatable Reads, but may still permit Phantom Reads in standard ANSI SQL?",
            "options": ["Read Uncommitted", "Read Committed", "Repeatable Read", "Serializable"],
            "correctOptionIndex": 2,
            "explanation": "In ANSI SQL, Repeatable Read prevents dirty and non-repeatable reads by snapshotting read rows, but another transaction may still insert new qualifying rows (phantom rows).",
            "tags": ["Databases", "ACID", "Transactions"],
            "hints": ["It repeats reads for existing rows."],
            "relatedRoadmapNodeId": "be-node-db"
        },
        {
            "id": "be-q6",
            "type": "multiple-choice",
            "difficulty": "beginner",
            "title": "Connection Pooling with PgBouncer",
            "question": "Why is an external connection pooler like PgBouncer essential for high-concurrency PostgreSQL backends?",
            "options": [
                "PostgreSQL uses a process-per-connection model where each client consumes several megabytes of RAM",
                "PostgreSQL does not support TCP connections natively",
                "PgBouncer encrypts passwords with AES",
                "To convert SQL queries into JSON"
            ],
            "correctOptionIndex": 0,
            "explanation": "PostgreSQL forks a dedicated backend operating system process per connection. Having thousands of idle connections causes context-switching overhead and memory exhaustion.",
            "tags": ["PostgreSQL", "Scalability", "DevOps"],
            "hints": ["Think about memory per client process."],
            "relatedRoadmapNodeId": "be-node-db"
        },
        {
            "id": "be-q7",
            "type": "architecture",
            "difficulty": "advanced",
            "title": "Consistent Hashing in Distributed Caches",
            "question": "What is the primary benefit of consistent hashing when scaling out distributed cache nodes?",
            "options": [
                "It eliminates all cache misses",
                "Adding or removing a server only requires re-mapping k/N keys instead of re-hashing all keys",
                "It guarantees ACID transactions across all nodes",
                "It encrypts key payloads"
            ],
            "correctOptionIndex": 1,
            "explanation": "With conventional modulo hashing `hash(key) % N`, changing N invalidates nearly 100% of keys. Consistent hashing arranges nodes on a ring so only a fraction `k/N` of keys migrate.",
            "tags": ["System Design", "Distributed Systems", "Caching"],
            "hints": ["Think of the hash ring."],
            "relatedRoadmapNodeId": "be-node-system"
        },
        {
            "id": "be-q8",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "gRPC vs REST Efficiency",
            "question": "Why does gRPC achieve significantly higher throughput and lower serialization overhead than traditional JSON REST?",
            "options": [
                "gRPC uses XML which parses faster",
                "gRPC uses binary Protocol Buffers over HTTP/2 multiplexed streams",
                "gRPC does not use TCP",
                "gRPC runs exclusively on GPUs"
            ],
            "correctOptionIndex": 1,
            "explanation": "Protocol Buffers encode data in compact binary format with pre-compiled schemas, avoiding JSON text parsing overhead, while HTTP/2 enables multiplexing without head-of-line blocking.",
            "tags": ["gRPC", "Protobuf", "APIs"],
            "hints": ["Binary schema serialization over HTTP/2."],
            "relatedRoadmapNodeId": "be-node-grpc"
        },
        {
            "id": "be-q9",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "OAuth 2.1 PKCE Flow",
            "question": "What security vulnerability does Proof Key for Code Exchange (PKCE) mitigate during authorization code flows?",
            "options": [
                "SQL Injection in database logins",
                "Authorization code interception attack on public mobile/SPA clients",
                "Buffer overflows in C servers",
                "DDoS attacks on authentication endpoints"
            ],
            "correctOptionIndex": 1,
            "explanation": "PKCE dynamically creates a cryptographic `code_verifier` and `code_challenge`, ensuring that only the exact client instance that requested the authorization code can exchange it for tokens.",
            "tags": ["Security", "OAuth", "Auth"],
            "hints": ["Public clients cannot protect client secrets."],
            "relatedRoadmapNodeId": "be-node-sec"
        },
        {
            "id": "be-q10",
            "type": "architecture",
            "difficulty": "advanced",
            "title": "Circuit Breaker Pattern",
            "question": "What state does a Circuit Breaker transition to when downstream service error rates exceed a defined threshold?",
            "options": ["Closed", "Open", "Half-Open", "Terminated"],
            "correctOptionIndex": 1,
            "explanation": "In the `Open` state, calls to the failing downstream service fail immediately without making network calls, preventing cascading thread pool exhaustion.",
            "tags": ["System Design", "Resilience", "Microservices"],
            "hints": ["Like an electrical circuit tripping."],
            "relatedRoadmapNodeId": "be-node-system"
        }
    ],
    "mobile": [
        {
            "id": "mob-q1",
            "type": "multiple-choice",
            "difficulty": "beginner",
            "title": "React Native Architecture",
            "question": "What is the primary architectural improvement of React Native's New Architecture (Fabric)?",
            "options": [
                "It replaces JavaScript with Python",
                "It eliminates the asynchronous JSON bridge using JavaScript Interface (JSI) for direct C++ host object access",
                "It requires Objective-C only",
                "It runs webviews inside native apps"
            ],
            "correctOptionIndex": 1,
            "explanation": "The New Architecture uses JSI (JavaScript Interface), allowing the JS runtime to directly invoke native C++ methods synchronously without serialization over an async bridge.",
            "tags": ["React Native", "Mobile", "Architecture"],
            "hints": ["Direct C++ pointers via JSI."],
            "relatedRoadmapNodeId": "mob-node-rn"
        },
        {
            "id": "mob-q2",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Flutter Widget Tree",
            "question": "In Flutter, what are the three distinct trees managed by the engine during rendering?",
            "options": [
                "Widget Tree, Element Tree, RenderObject Tree",
                "DOM Tree, CSS Tree, Frame Tree",
                "State Tree, Prop Tree, Component Tree",
                "Logic Tree, UI Tree, Hardware Tree"
            ],
            "correctOptionIndex": 0,
            "explanation": "Flutter maintains: 1) Widget Tree (immutable configuration), 2) Element Tree (lifecycle & manager), and 3) RenderObject Tree (computes layout sizing & paint instructions).",
            "tags": ["Flutter", "Dart", "Mobile"],
            "hints": ["Widget -> Element -> RenderObject."],
            "relatedRoadmapNodeId": "mob-node-flutter"
        },
        {
            "id": "mob-q3",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Android Activity Lifecycle",
            "question": "Which callback is invoked when an Android Activity is no longer visible to the user?",
            "options": ["onPause()", "onStop()", "onDestroy()", "onRestart()"],
            "correctOptionIndex": 1,
            "explanation": "`onStop()` is called when the activity is no longer visible (e.g. user navigated to home screen or another activity). `onPause()` is called when partially obscured.",
            "tags": ["Android", "Kotlin", "Lifecycle"],
            "hints": ["It's fully stopped from user view."],
            "relatedRoadmapNodeId": "mob-node-android"
        },
        {
            "id": "mob-q4",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "iOS Swift ARC (Memory Management)",
            "question": "What keyword in Swift is used to prevent strong reference cycles (memory retain cycles) between two class instances?",
            "options": ["mutating", "weak", "static", "defer"],
            "correctOptionIndex": 1,
            "explanation": "Marking a reference as `weak` prevents ARC from incrementing the object's retain count. When the referenced instance deallocates, weak references automatically become `nil`.",
            "tags": ["iOS", "Swift", "Memory Management"],
            "hints": ["Weak vs Unowned."],
            "relatedRoadmapNodeId": "mob-node-ios"
        },
        {
            "id": "mob-q5",
            "type": "architecture",
            "difficulty": "advanced",
            "title": "Mobile Offline Sync Architecture",
            "question": "What is the recommended approach for handling offline write synchronization in mobile apps?",
            "options": [
                "Block the UI until network reconnects",
                "Write optimistically to local storage (SQLite/WatermelonDB) with a sync mutation queue and vector clocks / CRDTs for conflict resolution",
                "Delete un-synced data when connection is lost",
                "Only allow read operations while offline"
            ],
            "correctOptionIndex": 1,
            "explanation": "Offline-first architectures write transactions immediately to a local embedded database and queue synchronization mutations with conflict resolution algorithms.",
            "tags": ["Offline Sync", "SQLite", "Architecture"],
            "hints": ["Local database first, sync later."],
            "relatedRoadmapNodeId": "mob-node-offline"
        },
        {
            "id": "mob-q6",
            "type": "multiple-choice",
            "difficulty": "beginner",
            "title": "Mobile App Deep Linking",
            "question": "What is the difference between custom URL schemes (e.g. `myapp://`) and Universal Links (iOS) / App Links (Android)?",
            "options": [
                "Custom URL schemes are deprecated and forbidden on all app stores",
                "Universal Links use standard HTTPS domains verified via apple-app-site-association / assetlinks.json, falling back to websites if not installed",
                "There is no functional difference",
                "Universal links only work on Wi-Fi"
            ],
            "correctOptionIndex": 1,
            "explanation": "Universal Links and Android App Links use standard HTTPS domains cryptographically verified via domain JSON association files, preventing hijacking.",
            "tags": ["Deep Linking", "iOS", "Android"],
            "hints": ["Verified HTTPS domains with web fallback."],
            "relatedRoadmapNodeId": "mob-node-linking"
        },
        {
            "id": "mob-q7",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Mobile Battery & Background Execution",
            "question": "What system constraint do iOS and Android place on continuous background location updates?",
            "options": [
                "Background location is always completely unlimited",
                "Apps must request background permissions, use geofencing or significant motion APIs to preserve battery",
                "Location hardware shuts down automatically after 10 seconds",
                "Only system apps can access GPS"
            ],
            "correctOptionIndex": 1,
            "explanation": "Continuous high-accuracy GPS depletes battery rapidly. OS platforms enforce explicit background location permissions and throttle background task execution.",
            "tags": ["Battery Optimization", "Mobile APIs"],
            "hints": ["Aggressive power management."],
            "relatedRoadmapNodeId": "mob-node-battery"
        },
        {
            "id": "mob-q8",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Expo vs Bare React Native",
            "question": "What feature enables developers to use arbitrary custom native iOS/Android code inside modern Expo apps?",
            "options": [
                "Expo Prebuild (Continuous Native Generation)",
                "Expo does not allow any custom native code",
                "Expo Web",
                "EAS Update"
            ],
            "correctOptionIndex": 0,
            "explanation": "Expo Prebuild generates the native `ios` and `android` project folders dynamically from config plugins, enabling arbitrary native modules without abandoning the managed workflow.",
            "tags": ["Expo", "React Native", "DevOps"],
            "hints": ["Config plugins generate native projects."],
            "relatedRoadmapNodeId": "mob-node-expo"
        },
        {
            "id": "mob-q9",
            "type": "multiple-choice",
            "difficulty": "advanced",
            "title": "Mobile App Security: Certificate Pinning",
            "question": "What attack vector does SSL/TLS Certificate Pinning defend against on mobile clients?",
            "options": [
                "Cross-Site Scripting (XSS)",
                "Man-in-the-Middle (MITM) proxy inspection using compromised or user-installed root Certificate Authorities",
                "SQL injection on local SQLite",
                "SIM swap attacks"
            ],
            "correctOptionIndex": 1,
            "explanation": "Certificate Pinning verifies that the server's public key matches the hardcoded certificate hash in the app bundle, rejecting forged certificates from rogue CAs.",
            "tags": ["Mobile Security", "SSL Pinning"],
            "hints": ["Mitigating proxy tools like Charles or mitmproxy."],
            "relatedRoadmapNodeId": "mob-node-sec"
        },
        {
            "id": "mob-q10",
            "type": "multiple-choice",
            "difficulty": "beginner",
            "title": "Mobile Frame Rate Target",
            "question": "What is the target frame render budget to ensure 60 frames-per-second (fps) smooth animations without stutter on mobile displays?",
            "options": ["16.6ms", "33.3ms", "100ms", "5ms"],
            "correctOptionIndex": 0,
            "explanation": "1000ms / 60 frames = approximately 16.6 milliseconds per frame. Exceeding this render budget leads to frame drops (jank).",
            "tags": ["Performance", "UI", "FPS"],
            "hints": ["1 second divided by 60."],
            "relatedRoadmapNodeId": "mob-node-perf"
        }
    ],
    "fullstack": [
        {
            "id": "fs-q1",
            "type": "architecture",
            "difficulty": "intermediate",
            "title": "End-to-End Type Safety",
            "question": "How does tRPC or Server Actions achieve end-to-end type safety between client and server without manual code generation?",
            "options": [
                "By transpiling all backend code to WebAssembly",
                "By sharing TypeScript type inference directly from server router definitions to client caller hooks",
                "By running client code directly inside PostgreSQL",
                "By compiling TypeScript into JSON schema files"
            ],
            "correctOptionIndex": 1,
            "explanation": "tRPC leverages TypeScript's type inference engine: the client imports only the `AppRouter` type signature from the server, giving instant autocomplete without build-time code gen.",
            "tags": ["TypeScript", "Fullstack", "tRPC"],
            "hints": ["Importing types, not runtime code."],
            "relatedRoadmapNodeId": "fs-node-types"
        },
        {
            "id": "fs-q2",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Next.js Route Handlers vs Server Actions",
            "question": "What is the primary semantic distinction between Route Handlers (`route.ts`) and Server Actions (`'use server'`)?",
            "options": [
                "Route Handlers can only return HTML",
                "Route Handlers provide standard REST endpoints (useful for webhooks and public APIs), while Server Actions provide RPC function calls directly tied to form submissions and mutations",
                "Server Actions cannot access headers or cookies",
                "There is no distinction"
            ],
            "correctOptionIndex": 1,
            "explanation": "Route Handlers (`app/api/.../route.ts`) are traditional HTTP endpoints with full control over headers, verbs, and webhooks. Server Actions are RPC functions invoked seamlessly from UI interactions.",
            "tags": ["Next.js", "Server Actions", "Fullstack"],
            "hints": ["Webhooks vs UI form actions."],
            "relatedRoadmapNodeId": "fs-node-next"
        },
        {
            "id": "fs-q3",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Cross-Site Request Forgery (CSRF)",
            "question": "Why are `SameSite=Lax` or `SameSite=Strict` HTTP-only cookies critical for securing session authentication?",
            "options": [
                "They prevent JavaScript from reading cookies (XSS protection) and prevent cross-site requests from transmitting cookies (CSRF protection)",
                "They increase cookie storage size to 1GB",
                "They automatically encrypt the database",
                "They replace HTTPS"
            ],
            "correctOptionIndex": 0,
            "explanation": "`HttpOnly` blocks client-side JavaScript from accessing cookies (mitigating token theft via XSS), while `SameSite=Lax/Strict` prevents third-party websites from attaching session cookies in cross-origin requests.",
            "tags": ["Security", "Authentication", "Cookies"],
            "hints": ["Defense in depth against XSS and CSRF."],
            "relatedRoadmapNodeId": "fs-node-sec"
        },
        {
            "id": "fs-q4",
            "type": "multiple-choice",
            "difficulty": "advanced",
            "title": "Database N+1 Query Problem",
            "question": "What is the most effective architectural solution to resolve the N+1 query problem when fetching relational child records?",
            "options": [
                "Query each record in a separate `while` loop",
                "Use batch loading (`IN` query) with tools like DataLoader or ORM eager loading (`include` / `JOIN`)",
                "Disable all foreign keys",
                "Store everything in one giant text file"
            ],
            "correctOptionIndex": 1,
            "explanation": "DataLoader or eager joins batch discrete ID lookups into a single `SELECT * FROM table WHERE id IN (...)`, reducing N database queries into 1 or 2 round-trips.",
            "tags": ["Databases", "GraphQL", "Performance"],
            "hints": ["Batching IDs into single SELECT query."],
            "relatedRoadmapNodeId": "fs-node-db"
        },
        {
            "id": "fs-q5",
            "type": "multiple-choice",
            "difficulty": "beginner",
            "title": "CORS (Cross-Origin Resource Sharing)",
            "question": "Under what condition does a web browser trigger an HTTP `OPTIONS` preflight request before sending an API call?",
            "options": [
                "For simple GET requests with text/plain headers",
                "When the cross-origin request uses non-simple HTTP methods (PUT, DELETE, PATCH) or custom headers (e.g. `Authorization`, `Content-Type: application/json`)",
                "Only when using Internet Explorer",
                "Whenever an image is requested"
            ],
            "correctOptionIndex": 1,
            "explanation": "Browsers send an automatic `OPTIONS` preflight to determine if the destination server permits non-simple methods or custom headers from the calling origin.",
            "tags": ["CORS", "Security", "HTTP"],
            "hints": ["Checking server permissions before dangerous mutations."],
            "relatedRoadmapNodeId": "fs-node-http"
        },
        {
            "id": "fs-q6",
            "type": "architecture",
            "difficulty": "advanced",
            "title": "CDN Edge Rendering (SSR at the Edge)",
            "question": "What are the trade-offs of deploying Fullstack applications to Edge Functions (e.g. Cloudflare Workers, Vercel Edge) compared to regional Node.js containers?",
            "options": [
                "Edge functions have unlimited RAM and full TCP socket support with zero cold starts",
                "Edge functions provide ultra-low latency worldwide for static/compute, but may face high latency if accessing a centralized relational database located thousands of miles away",
                "Edge functions cannot execute JavaScript",
                "Edge functions only run once per week"
            ],
            "correctOptionIndex": 1,
            "explanation": "While Edge computing puts compute physically near the user, if the function must connect to a central database in `us-east-1`, roundtrip latency can negate Edge speed advantages unless read replicas or connection pooling are used.",
            "tags": ["Edge Computing", "Architecture", "CDN"],
            "hints": ["Compute is near user, but where is the database?"],
            "relatedRoadmapNodeId": "fs-node-edge"
        },
        {
            "id": "fs-q7",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "WebSocket Connection Lifecycle",
            "question": "How does a WebSocket connection initialize over HTTP?",
            "options": [
                "Through an initial HTTP GET request with `Upgrade: websocket` and `Connection: Upgrade` headers",
                "Using UDP packets directly on port 53",
                "By opening an FTP tunnel",
                "By polling a JSON endpoint every millisecond"
            ],
            "correctOptionIndex": 0,
            "explanation": "WebSockets start with a standard HTTP request containing an `Upgrade: websocket` header. If the server agrees, it responds with status `101 Switching Protocols`.",
            "tags": ["WebSockets", "Networking", "Real-Time"],
            "hints": ["HTTP 101 Switching Protocols."],
            "relatedRoadmapNodeId": "fs-node-ws"
        },
        {
            "id": "fs-q8",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "Database Migrations in Production",
            "question": "What is the zero-downtime pattern for renaming a production database column?",
            "options": [
                "Run `ALTER TABLE users RENAME COLUMN old TO new;` directly in production during peak hours",
                "Expand-and-Contract: Add new column, dual-write in application, backfill historical data, switch reads to new column, and deprecate old column",
                "Drop the database and restore from backup",
                "Lock the entire table for 2 hours"
            ],
            "correctOptionIndex": 1,
            "explanation": "Direct column renames break running server instances. The Expand-and-Contract (Parallel Run) pattern ensures existing code continues operating safely across phased releases.",
            "tags": ["DevOps", "Database Migrations", "Reliability"],
            "hints": ["Expand, dual-write, contract."],
            "relatedRoadmapNodeId": "fs-node-db"
        },
        {
            "id": "fs-q9",
            "type": "multiple-choice",
            "difficulty": "intermediate",
            "title": "JWT vs Session Storage",
            "question": "What is a major limitation of stateless JSON Web Tokens (JWT) compared to server-stored sessions?",
            "options": [
                "JWTs cannot be decrypted by anyone",
                "Revoking a compromised JWT before its expiration time requires maintaining an active blocklist, which reintroduces stateful lookups",
                "JWTs only work in Python",
                "JWTs cannot store user IDs"
            ],
            "correctOptionIndex": 1,
            "explanation": "Because stateless JWTs are validated purely via cryptographic signature without checking a database, revoking an individual token early requires maintaining a revocation blacklist.",
            "tags": ["Security", "JWT", "Authentication"],
            "hints": ["How do you revoke a stolen JWT before expiry?"],
            "relatedRoadmapNodeId": "fs-node-auth"
        },
        {
            "id": "fs-q10",
            "type": "architecture",
            "difficulty": "advanced",
            "title": "Fullstack Observability: OpenTelemetry",
            "question": "What is the purpose of propagating the `traceparent` HTTP header across microservices in distributed tracing?",
            "options": [
                "To pass user passwords securely",
                "To correlate logs, spans, and metrics across disparate frontend and backend services into a single unified trace tree",
                "To compress JSON payloads by 50%",
                "To bypass CORS"
            ],
            "correctOptionIndex": 1,
            "explanation": "The W3C Trace Context standard (`traceparent`) links child spans back to the root request span, allowing engineers to trace a user request across all services and database calls.",
            "tags": ["Observability", "OpenTelemetry", "Architecture"],
            "hints": ["Distributed trace correlation."],
            "relatedRoadmapNodeId": "fs-node-obs"
        }
    ]
}

# Static Roadmap trees for each track (roadmap.sh layout)
STATIC_ROADMAPS = {
    "frontend": {
        "title": "Frontend Engineering Roadmap 2026",
        "tagline": "Modern Web Architecture from Protocols to Edge Performance",
        "description": "Comprehensive visual roadmap covering internet fundamentals, HTML5, modern CSS layouts, TypeScript, React 19, Next.js App Router, and Core Web Vitals.",
        "totalEstimatedHours": 180,
        "tiers": [
            {"tierNumber": 1, "title": "Internet & Web Protocols", "subtitle": "DNS, HTTP/2 & 3, SSL/TLS Handshake"},
            {"tierNumber": 2, "title": "HTML5 & Semantic Web", "subtitle": "Accessibility (WCAG AA), Semantic Outlines, SEO"},
            {"tierNumber": 3, "title": "CSS & Modern Styling Architecture", "subtitle": "Flexbox, CSS Grid, Tailwind CSS, Container Queries"},
            {"tierNumber": 4, "title": "JavaScript Runtime & TypeScript", "subtitle": "Event Loop, Closures, Generics, Discriminated Unions"},
            {"tierNumber": 5, "title": "React 19 & Next.js App Router", "subtitle": "Server Components, Server Actions, Suspense Streaming"},
            {"tierNumber": 6, "title": "Web Performance & Core Web Vitals", "subtitle": "Sub-2s LCP, INP Yielding, Zero CLS Layouts"}
        ],
        "nodes": [
            {
                "id": "fe-node-internet",
                "track": "frontend",
                "title": "How the Internet Works",
                "slug": "how-the-internet-works",
                "description": "Understand TCP/IP 3-way handshake, DNS recursive lookups, HTTP methods, headers, and TLS 1.3 encryption.",
                "status": "completed",
                "level": "fundamental",
                "tierNumber": 1,
                "position": {"column": "center", "order": 1},
                "prerequisites": [],
                "childrenIds": ["fe-node-html", "fe-node-css"],
                "keyConcepts": ["DNS Hierarchy", "TCP vs UDP", "HTTP/2 Multiplexing", "TLS Handshake"],
                "checklist": [
                    {"id": "fe-chk-1", "title": "Explain DNS recursive lookup from root to authoritative server", "completed": True},
                    {"id": "fe-chk-2", "title": "Inspect HTTP headers and Cache-Control directives in DevTools", "completed": True}
                ],
                "resources": [
                    {"title": "MDN: How Does the Internet Work?", "url": "https://developer.mozilla.org/en-US/docs/Learn/Common_questions/Web_mechanics/How_does_the_Internet_work", "type": "docs", "isFree": True}
                ],
                "badge": "Core Foundation",
                "estimatedHours": 12
            },
            {
                "id": "fe-node-html",
                "track": "frontend",
                "title": "Semantic HTML & Accessibility",
                "slug": "semantic-html-and-a11y",
                "description": "Document outlines, form validations, ARIA attributes, keyboard navigation, and WCAG 2.2 AA compliance.",
                "status": "completed",
                "level": "fundamental",
                "tierNumber": 2,
                "position": {"column": "left", "order": 1},
                "prerequisites": ["fe-node-internet"],
                "childrenIds": ["fe-node-js"],
                "keyConcepts": ["Semantic Tags", "ARIA Roles & States", "Focus Trapping", "Color Contrast"],
                "checklist": [
                    {"id": "fe-chk-3", "title": "Build a fully keyboard-navigable modal dialog", "completed": True},
                    {"id": "fe-chk-4", "title": "Audit WCAG AA compliance using axe DevTools", "completed": True}
                ],
                "resources": [
                    {"title": "A11Y Project Checklist", "url": "https://www.a11yproject.com/checklist/", "type": "docs", "isFree": True}
                ],
                "badge": "Essential",
                "estimatedHours": 14
            },
            {
                "id": "fe-node-css",
                "track": "frontend",
                "title": "Modern CSS, Flexbox & Grid",
                "slug": "modern-css-flexbox-grid",
                "description": "1D and 2D layout algorithms, custom properties (CSS variables), container queries, and utility architecture.",
                "status": "completed",
                "level": "fundamental",
                "tierNumber": 2,
                "position": {"column": "right", "order": 2},
                "prerequisites": ["fe-node-internet"],
                "childrenIds": ["fe-node-js"],
                "keyConcepts": ["CSS Grid Repeat & Auto-fit", "Flex Alignment", "Container Queries", "Tailwind Design Tokens"],
                "checklist": [
                    {"id": "fe-chk-5", "title": "Build a responsive holy-grail layout using CSS Grid", "completed": True},
                    {"id": "fe-chk-6", "title": "Implement dark/light mode switching with CSS custom properties", "completed": True}
                ],
                "resources": [
                    {"title": "CSS-Tricks: Complete Guide to Grid", "url": "https://css-tricks.com/snippets/css/complete-guide-grid/", "type": "article", "isFree": True}
                ],
                "badge": "Design System",
                "estimatedHours": 18
            },
            {
                "id": "fe-node-js",
                "track": "frontend",
                "title": "JavaScript Event Loop & ES2024+",
                "slug": "javascript-event-loop-es2024",
                "description": "Master the single-threaded event loop, call stack, microtask queue, closures, prototypes, and async/await.",
                "status": "in-progress",
                "level": "intermediate",
                "tierNumber": 3,
                "position": {"column": "center", "order": 1},
                "prerequisites": ["fe-node-html", "fe-node-css"],
                "childrenIds": ["fe-node-ts", "fe-node-react"],
                "keyConcepts": ["Call Stack vs Microtasks", "Lexical Closures", "Prototypal Inheritance", "ES Modules"],
                "checklist": [
                    {"id": "fe-chk-7", "title": "Implement debounce and throttle functions from scratch", "completed": True},
                    {"id": "fe-chk-8", "title": "Demonstrate microtask vs macrotask execution order in interview", "completed": False}
                ],
                "resources": [
                    {"title": "JavaScript.info Modern Tutorial", "url": "https://javascript.info/", "type": "docs", "isFree": True}
                ],
                "badge": "Core Engine",
                "estimatedHours": 25
            },
            {
                "id": "fe-node-ts",
                "track": "frontend",
                "title": "TypeScript Mastery & Generics",
                "slug": "typescript-mastery-generics",
                "description": "Static type safety, mapped types, conditional types, discriminated unions, and generic constraints.",
                "status": "in-progress",
                "level": "intermediate",
                "tierNumber": 4,
                "position": {"column": "left", "order": 1},
                "prerequisites": ["fe-node-js"],
                "childrenIds": ["fe-node-react"],
                "keyConcepts": ["Discriminated Unions", "Generics (`extends`)", "`infer` keyword", "Utility Types"],
                "checklist": [
                    {"id": "fe-chk-9", "title": "Build a type-safe event bus using generic listeners", "completed": True},
                    {"id": "fe-chk-10", "title": "Create exhaustive switch cases using `never` check", "completed": False}
                ],
                "resources": [
                    {"title": "Total TypeScript by Matt Pocock", "url": "https://www.totaltypescript.com/", "type": "docs", "isFree": True}
                ],
                "badge": "Type Safety",
                "estimatedHours": 20
            },
            {
                "id": "fe-node-react",
                "track": "frontend",
                "title": "React 19 & Next.js App Router",
                "slug": "react-19-nextjs-app-router",
                "description": "Component reconciliation, hooks lifecycle, React Server Components (RSC), Suspense streaming, and Server Actions.",
                "status": "in-progress",
                "level": "advanced",
                "tierNumber": 5,
                "position": {"column": "center", "order": 1},
                "prerequisites": ["fe-node-ts"],
                "childrenIds": ["fe-node-perf"],
                "keyConcepts": ["Fiber Reconciliation", "Server Components (RSC)", "Server Actions", "Streaming with Suspense"],
                "checklist": [
                    {"id": "fe-chk-11", "title": "Build a fullstack CRUD feature using Server Actions", "completed": False},
                    {"id": "fe-chk-12", "title": "Profile component renders using React DevTools Profiler", "completed": False}
                ],
                "resources": [
                    {"title": "React Official Documentation", "url": "https://react.dev/", "type": "docs", "isFree": True}
                ],
                "badge": "Industry Standard",
                "estimatedHours": 35
            },
            {
                "id": "fe-node-perf",
                "track": "frontend",
                "title": "Core Web Vitals & Web Performance",
                "slug": "core-web-vitals-performance",
                "description": "Achieve sub-2s Largest Contentful Paint (LCP), Interaction to Next Paint (INP) under 200ms, and zero layout shifts.",
                "status": "planned",
                "level": "advanced",
                "tierNumber": 6,
                "position": {"column": "center", "order": 1},
                "prerequisites": ["fe-node-react"],
                "childrenIds": [],
                "keyConcepts": ["LCP Optimization", "INP & scheduler.yield()", "Zero CLS Layouts", "Bundle Analyzer"],
                "checklist": [
                    {"id": "fe-chk-13", "title": "Audit production Lighthouse score to 95+ on mobile", "completed": False},
                    {"id": "fe-chk-14", "title": "Eliminate Long Animation Frames (LoAF) on interactive components", "completed": False}
                ],
                "resources": [
                    {"title": "web.dev Core Web Vitals", "url": "https://web.dev/vitals/", "type": "docs", "isFree": True}
                ],
                "badge": "Senior Level",
                "estimatedHours": 20
            }
        ]
    },
    "backend": {
        "title": "Backend Engineering & Systems Roadmap",
        "tagline": "Distributed Systems, High-Concurrency Runtimes, and Cloud Scalability",
        "description": "From asynchronous I/O and PostgreSQL to Redis caching, message streaming with Kafka, and distributed consensus.",
        "totalEstimatedHours": 195,
        "tiers": [
            {"tierNumber": 1, "title": "Runtimes & Operating Systems", "subtitle": "Linux internals, Async I/O, POSIX"},
            {"tierNumber": 2, "title": "Relational Databases & SQL", "subtitle": "PostgreSQL, ACID, B-Tree & GIN Indexes"},
            {"tierNumber": 3, "title": "In-Memory Caching & Stores", "subtitle": "Redis, Redlock, Cache-Aside Patterns"},
            {"tierNumber": 4, "title": "APIs & Protocols", "subtitle": "REST, gRPC, Protobuf, WebSockets"},
            {"tierNumber": 5, "title": "Distributed Messaging & Scale", "subtitle": "Kafka, Partitions, Consensus, Circuit Breakers"}
        ],
        "nodes": [
            {
                "id": "be-node-runtime",
                "track": "backend",
                "title": "Asynchronous I/O & Linux Systems",
                "slug": "async-io-linux-systems",
                "description": "Understand non-blocking event-driven architectures (epoll/kqueue), memory allocation, and systemd process management.",
                "status": "completed",
                "level": "fundamental",
                "tierNumber": 1,
                "position": {"column": "center", "order": 1},
                "prerequisites": [],
                "childrenIds": ["be-node-db"],
                "keyConcepts": ["Non-blocking I/O", "Process vs Thread", "File Descriptors & Sockets"],
                "checklist": [
                    {"id": "be-chk-1", "title": "Build a high-concurrency TCP echo server handling 10,000 connections", "completed": True}
                ],
                "resources": [
                    {"title": "The Linux Command Line", "url": "https://linuxcommand.org/", "type": "docs", "isFree": True}
                ],
                "badge": "Core",
                "estimatedHours": 20
            },
            {
                "id": "be-node-db",
                "track": "backend",
                "title": "PostgreSQL & Database Internals",
                "slug": "postgresql-database-internals",
                "description": "Master ACID transactions, WAL write-ahead logging, B-Tree and GIN indexes, query planning with EXPLAIN ANALYZE, and connection pooling.",
                "status": "in-progress",
                "level": "intermediate",
                "tierNumber": 2,
                "position": {"column": "left", "order": 1},
                "prerequisites": ["be-node-runtime"],
                "childrenIds": ["be-node-redis", "be-node-api"],
                "keyConcepts": ["ACID Isolation Levels", "B-Tree vs GIN Index", "PgBouncer Pooling", "Query Optimization"],
                "checklist": [
                    {"id": "be-chk-2", "title": "Optimize a slow query by analyzing EXPLAIN (ANALYZE, BUFFERS)", "completed": True},
                    {"id": "be-chk-3", "title": "Implement zero-downtime schema migrations", "completed": False}
                ],
                "resources": [
                    {"title": "Use The Index, Luke!", "url": "https://use-the-index-luke.com/", "type": "docs", "isFree": True}
                ],
                "badge": "Crucial",
                "estimatedHours": 30
            },
            {
                "id": "be-node-redis",
                "track": "backend",
                "title": "Redis Caching & Concurrency",
                "slug": "redis-caching-concurrency",
                "description": "In-memory data structures, cache-aside pattern, distributed locking with Redlock, sliding-window rate limiters, and Pub/Sub.",
                "status": "in-progress",
                "level": "intermediate",
                "tierNumber": 3,
                "position": {"column": "right", "order": 1},
                "prerequisites": ["be-node-db"],
                "childrenIds": ["be-node-system"],
                "keyConcepts": ["Redis Hashes & Sorted Sets", "Sliding-Window Rate Limiting", "Distributed Redlock", "Cache Stampede Prevention"],
                "checklist": [
                    {"id": "be-chk-4", "title": "Implement a distributed rate-limiter using Redis ZSET", "completed": True}
                ],
                "resources": [
                    {"title": "Redis Official Architecture Docs", "url": "https://redis.io/docs/", "type": "docs", "isFree": True}
                ],
                "badge": "High Impact",
                "estimatedHours": 18
            },
            {
                "id": "be-node-api",
                "track": "backend",
                "title": "API Design: REST, gRPC & WebSockets",
                "slug": "api-design-rest-grpc-websockets",
                "description": "Design resilient public and internal APIs. Protocol Buffers, HTTP/2 streaming with gRPC, OpenAPI 3.1 specs, and WebSocket channels.",
                "status": "in-progress",
                "level": "intermediate",
                "tierNumber": 4,
                "position": {"column": "left", "order": 1},
                "prerequisites": ["be-node-db"],
                "childrenIds": ["be-node-kafka"],
                "keyConcepts": ["Idempotency", "Protocol Buffers", "gRPC Bidirectional Streaming", "OpenAPI"],
                "checklist": [
                    {"id": "be-chk-5", "title": "Define a gRPC service and compile client stubs", "completed": True}
                ],
                "resources": [
                    {"title": "gRPC Official Guide", "url": "https://grpc.io/docs/", "type": "docs", "isFree": True}
                ],
                "badge": "Architecture",
                "estimatedHours": 25
            },
            {
                "id": "be-node-kafka",
                "track": "backend",
                "title": "Message Brokers & Kafka",
                "slug": "kafka-event-driven-streaming",
                "description": "Event-driven architecture, distributed commit logs, partitions, consumer groups, offset commits, and dead letter queues.",
                "status": "planned",
                "level": "advanced",
                "tierNumber": 5,
                "position": {"column": "center", "order": 1},
                "prerequisites": ["be-node-api", "be-node-redis"],
                "childrenIds": ["be-node-system"],
                "keyConcepts": ["Partition Ordering", "Consumer Group Rebalancing", "At-Least-Once Delivery", "DLQ"],
                "checklist": [
                    {"id": "be-chk-6", "title": "Build an event-driven worker consuming from partitioned topic", "completed": False}
                ],
                "resources": [
                    {"title": "Confluent Kafka Architecture Guide", "url": "https://developer.confluent.io/", "type": "docs", "isFree": True}
                ],
                "badge": "Enterprise Scale",
                "estimatedHours": 30
            },
            {
                "id": "be-node-system",
                "track": "backend",
                "title": "Distributed Systems & Scalability",
                "slug": "distributed-systems-scalability",
                "description": "Consistent hashing rings, circuit breakers, CQRS, database sharding, CAP theorem trade-offs, and distributed tracing.",
                "status": "planned",
                "level": "advanced",
                "tierNumber": 5,
                "position": {"column": "right", "order": 2},
                "prerequisites": ["be-node-kafka"],
                "childrenIds": [],
                "keyConcepts": ["Consistent Hashing", "Circuit Breakers", "Distributed Tracing", "CAP Theorem"],
                "checklist": [
                    {"id": "be-chk-7", "title": "Design a globally distributed URL shortener handling 100k requests/sec", "completed": False}
                ],
                "resources": [
                    {"title": "System Design Primer by Donne Martin", "url": "https://github.com/donnemartin/system-design-primer", "type": "github", "isFree": True}
                ],
                "badge": "Architect Level",
                "estimatedHours": 40
            }
        ]
    },
    "mobile": {
        "title": "Mobile Engineering Roadmap (React Native & Flutter)",
        "tagline": "Cross-Platform and Native High-Performance Applications",
        "description": "Native thread architectures, offline sync with SQLite, deep linking, background location, and mobile security.",
        "totalEstimatedHours": 160,
        "tiers": [
            {"tierNumber": 1, "title": "Mobile Runtimes & Frameworks", "subtitle": "React Native (JSI/Fabric), Flutter Widget Engine"},
            {"tierNumber": 2, "title": "Native Platform Lifecycles", "subtitle": "Android Activity Lifecycle, iOS Swift ARC"},
            {"tierNumber": 3, "title": "Offline-First & Local Storage", "subtitle": "SQLite, WatermelonDB, Conflict Resolution"},
            {"tierNumber": 4, "title": "Native Device APIs & Security", "subtitle": "Background Tasks, Push Notifications, SSL Pinning"}
        ],
        "nodes": [
            {
                "id": "mob-node-rn",
                "track": "mobile",
                "title": "React Native & New Architecture (JSI)",
                "slug": "react-native-new-architecture",
                "description": "Fabric rendering engine, TurboModules, synchronous C++ host object calls via JSI, and gesture handlers.",
                "status": "completed",
                "level": "fundamental",
                "tierNumber": 1,
                "position": {"column": "center", "order": 1},
                "prerequisites": [],
                "childrenIds": ["mob-node-offline"],
                "keyConcepts": ["JSI vs Legacy Bridge", "Fabric Renderer", "TurboModules", "Reanimated 3 Worklets"],
                "checklist": [
                    {"id": "mob-chk-1", "title": "Build a 60fps gesture-driven swipeable card using Reanimated", "completed": True}
                ],
                "resources": [
                    {"title": "React Native New Architecture Docs", "url": "https://reactnative.dev/docs/the-new-architecture/landing-page", "type": "docs", "isFree": True}
                ],
                "badge": "Modern Mobile",
                "estimatedHours": 30
            },
            {
                "id": "mob-node-offline",
                "track": "mobile",
                "title": "Offline-First Data & SQLite",
                "slug": "offline-first-data-sqlite",
                "description": "Embedded databases, optimistic UI mutation queues, offline-first sync protocols, and CRDT conflict resolution.",
                "status": "in-progress",
                "level": "intermediate",
                "tierNumber": 2,
                "position": {"column": "left", "order": 1},
                "prerequisites": ["mob-node-rn"],
                "childrenIds": ["mob-node-sec"],
                "keyConcepts": ["SQLite Embedded Database", "Mutation Sync Queue", "Optimistic State Rollback"],
                "checklist": [
                    {"id": "mob-chk-2", "title": "Implement an offline mutation queue that replays when connectivity resumes", "completed": True}
                ],
                "resources": [
                    {"title": "WatermelonDB Architecture", "url": "https://watermelondb.dev/docs", "type": "docs", "isFree": True}
                ],
                "badge": "Core Pattern",
                "estimatedHours": 25
            },
            {
                "id": "mob-node-sec",
                "track": "mobile",
                "title": "Mobile Security & Biometrics",
                "slug": "mobile-security-biometrics",
                "description": "Keychain / Keystore hardware-backed encryption, FaceID/TouchID biometrics, and SSL certificate pinning.",
                "status": "planned",
                "level": "advanced",
                "tierNumber": 3,
                "position": {"column": "right", "order": 1},
                "prerequisites": ["mob-node-offline"],
                "childrenIds": [],
                "keyConcepts": ["Secure Enclave / KeyStore", "Biometric Authentication", "SSL Certificate Pinning"],
                "checklist": [
                    {"id": "mob-chk-3", "title": "Store sensitive tokens in iOS Keychain and Android KeyStore", "completed": False}
                ],
                "resources": [
                    {"title": "OWASP Mobile Security Project", "url": "https://owasp.org/www-project-mobile-security/", "type": "docs", "isFree": True}
                ],
                "badge": "Security",
                "estimatedHours": 20
            }
        ]
    },
    "fullstack": {
        "title": "Fullstack Engineering Roadmap",
        "tagline": "Connecting Scalable Cloud Backends with Polished Client Applications",
        "description": "End-to-end type safety, Server Actions, database replication, CDN edge caching, and distributed observability.",
        "totalEstimatedHours": 200,
        "tiers": [
            {"tierNumber": 1, "title": "End-to-End Type Safety", "subtitle": "TypeScript, tRPC, Shared Schemas"},
            {"tierNumber": 2, "title": "Fullstack Frameworks", "subtitle": "Next.js App Router, Server Actions, Remix"},
            {"tierNumber": 3, "title": "Database Scalability & Caching", "subtitle": "PostgreSQL, Prisma/Drizzle, Redis"},
            {"tierNumber": 4, "title": "Security, Auth & Edge Infrastructure", "subtitle": "OAuth2/OIDC, Cloudflare Workers, OpenTelemetry"}
        ],
        "nodes": [
            {
                "id": "fs-node-types",
                "track": "fullstack",
                "title": "End-to-End Type Safety & Contracts",
                "slug": "end-to-end-type-safety-contracts",
                "description": "Zero-cost type inference between frontend client hooks and backend database models using tRPC, Zod, and Prisma/Drizzle.",
                "status": "completed",
                "level": "fundamental",
                "tierNumber": 1,
                "position": {"column": "center", "order": 1},
                "prerequisites": [],
                "childrenIds": ["fs-node-next"],
                "keyConcepts": ["Type Inference Across Network", "Zod Validation", "Database ORM Types"],
                "checklist": [
                    {"id": "fs-chk-1", "title": "Build a tRPC procedure validating input schemas with Zod", "completed": True}
                ],
                "resources": [
                    {"title": "tRPC Official Documentation", "url": "https://trpc.io/docs", "type": "docs", "isFree": True}
                ],
                "badge": "Type Safety",
                "estimatedHours": 20
            },
            {
                "id": "fs-node-next",
                "track": "fullstack",
                "title": "Server Actions & Modern Fullstack Routing",
                "slug": "server-actions-fullstack-routing",
                "description": "Unify server mutations and client UI updates using Server Actions, optimistic revalidation, and streaming SSR.",
                "status": "in-progress",
                "level": "intermediate",
                "tierNumber": 2,
                "position": {"column": "left", "order": 1},
                "prerequisites": ["fs-node-types"],
                "childrenIds": ["fs-node-edge"],
                "keyConcepts": ["Server Actions", "Optimistic Mutations", "Cache Invalidation (`revalidatePath`)"],
                "checklist": [
                    {"id": "fs-chk-2", "title": "Implement optimistic UI mutations with rollback on network failure", "completed": True}
                ],
                "resources": [
                    {"title": "Next.js Server Actions Guide", "url": "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations", "type": "docs", "isFree": True}
                ],
                "badge": "Core",
                "estimatedHours": 30
            },
            {
                "id": "fs-node-edge",
                "track": "fullstack",
                "title": "Edge Compute & Observability",
                "slug": "edge-compute-observability",
                "description": "Deploy to CDN Edge Workers worldwide, mitigate central database latency, and instrument distributed tracing with OpenTelemetry.",
                "status": "planned",
                "level": "advanced",
                "tierNumber": 3,
                "position": {"column": "center", "order": 1},
                "prerequisites": ["fs-node-next"],
                "childrenIds": [],
                "keyConcepts": ["Edge Functions", "OpenTelemetry Distributed Tracing", "Read Replicas"],
                "checklist": [
                    {"id": "fs-chk-3", "title": "Instrument OpenTelemetry tracing across frontend and backend services", "completed": False}
                ],
                "resources": [
                    {"title": "OpenTelemetry Documentation", "url": "https://opentelemetry.io/docs/", "type": "docs", "isFree": True}
                ],
                "badge": "Enterprise",
                "estimatedHours": 25
            }
        ]
    }
}

def validate_daily_practice_payload(payload):
    """Strict schema validation for daily practice JSON payload."""
    assert payload.get("version") == "1.0.0", "Invalid payload version"
    assert payload.get("track") in TRACKS, f"Invalid track: {payload.get('track')}"
    assert len(payload.get("questions", [])) == 10, f"Expected exactly 10 questions, got {len(payload.get('questions', []))}"
    
    for idx, q in enumerate(payload["questions"]):
        assert "id" in q and q["id"], f"Question {idx} missing id"
        assert q["type"] in ["multiple-choice", "code-analysis", "architecture"], f"Invalid type in question {idx}"
        assert q["difficulty"] in ["beginner", "intermediate", "advanced"], f"Invalid difficulty in question {idx}"
        assert len(q.get("options", [])) >= 2, f"Question {idx} must have at least 2 options"
        assert 0 <= q.get("correctOptionIndex", -1) < len(q["options"]), f"Invalid correctOptionIndex in question {idx}"
        assert q.get("explanation"), f"Question {idx} missing explanation"

def generate_checksum(data_str):
    return hashlib.sha256(data_str.encode("utf-8")).hexdigest()[:16]

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_data_dir = os.path.join(base_dir, "public", "data")
    practice_base = os.path.join(public_data_dir, "practice")
    roadmaps_base = os.path.join(public_data_dir, "roadmaps")

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    
    print(f"🚀 [Practice Engine Generator] Running at {now.isoformat()} for date {today_str}")

    # 1. Generate Static Roadmaps for all 4 tracks
    os.makedirs(roadmaps_base, exist_ok=True)
    for track, data in STATIC_ROADMAPS.items():
        roadmap_payload = {
            "version": "1.0.0",
            "roadmapId": track,
            "title": data["title"],
            "tagline": data["tagline"],
            "description": data["description"],
            "updatedAt": now.isoformat(),
            "totalEstimatedHours": data["totalEstimatedHours"],
            "tiers": data["tiers"],
            "nodes": data["nodes"]
        }
        out_file = os.path.join(roadmaps_base, f"{track}.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(roadmap_payload, f, indent=2, ensure_ascii=False)
        print(f"  ✓ Written static roadmap: public/data/roadmaps/{track}.json ({len(data['nodes'])} nodes)")

    # 2. Generate Daily Practice 10-Question Payloads for all 4 tracks
    for track in TRACKS:
        track_dir = os.path.join(practice_base, track)
        os.makedirs(track_dir, exist_ok=True)

        questions = QUESTIONS_CATALOG.get(track, QUESTIONS_CATALOG["frontend"])
        
        # Track titles
        track_titles = {
            "frontend": "Frontend Engineering Daily Drill",
            "backend": "Backend & Distributed Systems Daily Drill",
            "mobile": "Mobile & Native App Daily Drill",
            "fullstack": "Fullstack Architecture Daily Drill"
        }

        payload = {
            "version": "1.0.0",
            "date": today_str,
            "track": track,
            "trackTitle": track_titles.get(track, f"{track.capitalize()} Daily Practice"),
            "generatedAt": now.isoformat(),
            "checksum": "",
            "totalQuestions": 10,
            "questions": questions
        }

        # Compute deterministic checksum
        raw_json_str = json.dumps(payload, sort_keys=True)
        payload["checksum"] = generate_checksum(raw_json_str)

        # Validate against schema
        validate_daily_practice_payload(payload)

        # Write date-stamped file: /data/practice/[track]/[YYYY-MM-DD].json
        date_file = os.path.join(track_dir, f"{today_str}.json")
        with open(date_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        # Write latest.json pointer: /data/practice/[track]/latest.json
        latest_file = os.path.join(track_dir, "latest.json")
        with open(latest_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        print(f"  ✓ Written 10 validated questions for {track}:")
        print(f"      -> public/data/practice/{track}/{today_str}.json")
        print(f"      -> public/data/practice/{track}/latest.json")

    print("\n✅ All static roadmap and practice JSON assets generated & validated successfully!")

if __name__ == "__main__":
    main()
