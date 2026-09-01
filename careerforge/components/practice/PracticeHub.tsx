"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Section } from "@/components/ui/Section";
import { Card, PrimaryButton, GhostButton, Tag } from "@/components/ui/Primitives";
import { useApp } from "@/lib/store";
import { startSpeechRecognition, SpeechRecognitionController } from "@/lib/voice";

export interface PracticeQuestion {
  id: string;
  type: "Technical" | "Behavioral" | "System Design";
  question: string;
  hint: string;
  standardConcept: {
    title: string;
    definition: string;
    keyTakeaways: string[];
  };
}

const PRACTICE_QUESTIONS: Record<string, PracticeQuestion[]> = {
  frontend: [
    {
      id: "fe-1",
      type: "Technical",
      question: "Explain the JavaScript Event Loop, and how microtasks (Promises) differ from macrotasks (setTimeout) in execution priority.",
      hint: "Mention the call stack, microtask queue priority, and rendering frame ticks.",
      standardConcept: {
        title: "JavaScript Event Loop & Task Queue Priority",
        definition:
          "JavaScript executes on a single-threaded runtime driven by the Event Loop. The call stack handles synchronous execution frames. When synchronous code finishes, the runtime empties the **Microtask Queue** (Promises, queueMicrotask, MutationObserver) in its entirety before processing a single **Macrotask** (setTimeout, setInterval, I/O events, setImmediate).",
        keyTakeaways: [
          "Microtasks always run immediately after synchronous stack execution and before next paint / macrotask.",
          "Starvation can occur if recursive microtasks prevent macrotask and UI rendering frames from executing.",
          "Rendering frame ticks occur between macrotasks when the browser prepares the compositor tree.",
        ],
      },
    },
    {
      id: "fe-2",
      type: "Technical",
      question: "How does React 18/19 reconciliation and virtual DOM diffing work under the hood? When should you use useMemo or useCallback?",
      hint: "Discuss component re-renders, fiber tree reconciliation, and referential equality.",
      standardConcept: {
        title: "React Fiber Reconciliation & Memoization Heuristics",
        definition:
          "React utilizes a double-buffered **Fiber Tree** architecture that splits rendering into interruptible units of work. The reconciler diffs old and new fiber nodes based on element type and key stability. `useMemo` caches computational values, while `useCallback` preserves referential identity of function references across re-renders to prevent downstream child component un-memoization.",
        keyTakeaways: [
          "Fiber nodes represent work units enabling Concurrent Mode time-slicing and priority lanes.",
          "Keys must be persistent and unique across sibling elements to avoid unneeded DOM unmounting.",
          "Only use useMemo/useCallback when passing callbacks to memoized children (React.memo) or expensive calculation loops.",
        ],
      },
    },
    {
      id: "fe-3",
      type: "Behavioral",
      question: "Tell me about a time you faced a critical performance bottleneck or bug in production. How did you diagnose and resolve it?",
      hint: "Use the STAR method: Situation, Task, Action (profiling/Lighthouse), and Result (quantified metrics).",
      standardConcept: {
        title: "STAR Structured Problem Resolution in Frontend Systems",
        definition:
          "High-impact behavioral performance responses require systematic profiling: Situation (production traffic scale), Task (latency or memory leak target), Action (Chrome DevTools Performance profiling, flame graph diagnosis, bundle tree-shaking, code-splitting), and Result (quantified metrics like 40% LCP reduction and zero dropped frames).",
        keyTakeaways: [
          "Always cite objective profiling data over intuitive guessing.",
          "Break down solutions into immediate mitigation and long-term architectural prevention.",
          "Quantify the business impact (e.g., conversion boost, SEO core vitals pass).",
        ],
      },
    },
    {
      id: "fe-4",
      type: "System Design",
      question: "How would you architect a high-traffic e-commerce checkout page to ensure fast Core Web Vitals (LCP < 1.8s) and zero layout shifts?",
      hint: "Discuss code splitting, critical CSS, skeleton states, dynamic imports, and optimistic updates.",
      standardConcept: {
        title: "Zero-CLS & Sub-2s LCP Web Architecture",
        definition:
          "Optimizing critical transactional pages requires: critical CSS inlining, pre-allocating exact container aspect ratios (`aspect-ratio` / explicit width & height) to guarantee 0 CLS, SSR/Edge streaming for immediate first paint, lazy-loading payment modals via dynamic imports, and optimistic UI mutations for cart updates.",
        keyTakeaways: [
          "Largest Contentful Paint (LCP) must prioritize hero elements with `fetchpriority='high'` and preloaded web fonts.",
          "Cumulative Layout Shift (CLS) is prevented by strict layout space reservations and skeleton loaders.",
          "Interaction to Next Paint (INP) is kept under 200ms by offloading heavy work to Web Workers.",
        ],
      },
    },
  ],
  backend: [
    {
      id: "be-1",
      type: "Technical",
      question: "What are the trade-offs between REST, GraphQL, and gRPC architectures? When would you choose one over the other?",
      hint: "Discuss over-fetching, caching layers, schema complexity, binary serialization, and payload overhead.",
      standardConcept: {
        title: "API Protocols & Architectural Trade-Offs",
        definition:
          "**REST** provides standard HTTP caching and broad public compatibility; **GraphQL** eliminates over/under-fetching with client-specified field selection for complex frontend graphs; **gRPC** leverages HTTP/2 and Protocol Buffers binary serialization for ultra-low latency, strongly typed internal microservice communication.",
        keyTakeaways: [
          "Use REST for public external APIs requiring straightforward HTTP CDN caching.",
          "Use GraphQL for multi-client consumer platforms with heterogeneous data querying requirements.",
          "Use gRPC for high-throughput internal microservice-to-microservice RPCs.",
        ],
      },
    },
    {
      id: "be-2",
      type: "System Design",
      question: "Design a scalable rate-limiting system for a public API handling 50,000 requests per second across distributed servers.",
      hint: "Mention Token Bucket vs Sliding Window algorithms, Redis cluster key expiration, and 429 response headers.",
      standardConcept: {
        title: "Distributed Rate Limiting & Sliding Window Counter",
        definition:
          "Scalable distributed rate limiting uses the **Sliding Window Log / Sliding Window Counter** algorithm implemented in a Redis Cluster. Requests increment sliding epoch buckets with atomic Lua scripts. Over-limit requests receive HTTP `429 Too Many Requests` with `Retry-After` and `X-RateLimit-Reset` headers.",
        keyTakeaways: [
          "Token Bucket accommodates bursts; Sliding Window Counter provides uniform strict compliance.",
          "Atomic Redis Lua scripts prevent race conditions in multi-instance clusters.",
          "Fallback local in-memory token buckets (e.g. Guava) provide resilience during Redis partition timeouts.",
        ],
      },
    },
    {
      id: "be-3",
      type: "Behavioral",
      question: "Describe a situation where you had to negotiate an architectural decision or technical debt with a product manager.",
      hint: "Highlight business alignment, risk mitigation, developer velocity metrics, and compromise strategies.",
      standardConcept: {
        title: "Engineering-to-Product Alignment & Technical Debt ROI",
        definition:
          "Aligning technical architecture with product roadmaps requires framing technical debt in terms of business risk, release velocity, failure blast radius, and infrastructure cost. Solutions include allocating a dedicated 20% sprint refactor budget or bundling architecture fixes inside upcoming feature deliverables.",
        keyTakeaways: [
          "Translate refactors into business outcomes: uptime SLAs, response latency, and team delivery velocity.",
          "Establish measurable risk thresholds and rollback criteria.",
          "Adopt incremental strangler-fig migration over risky big-bang rewrites.",
        ],
      },
    },
    {
      id: "be-4",
      type: "Technical",
      question: "Explain database ACID properties, transaction isolation levels (Read Committed vs Serializable), and how to prevent deadlocks.",
      hint: "Discuss lock escalations, row-level locks, MVCC (Multi-Version Concurrency Control), and index ordering.",
      standardConcept: {
        title: "Database ACID Guarantees & Transaction Isolation",
        definition:
          "**ACID** ensures Atomicity, Consistency, Isolation, and Durability. Isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable) balance concurrency with phenomena like dirty reads, non-repeatable reads, and phantom reads. Deadlocks are prevented by enforcing consistent global lock acquisition order and short transaction spans.",
        keyTakeaways: [
          "Modern relational databases (PostgreSQL/MySQL) rely on Multi-Version Concurrency Control (MVCC) for non-blocking reads.",
          "Serializable isolation provides the strictest guarantee via optimistic concurrency control (SSI).",
          "Acquire row locks in consistent primary key order across all application endpoints to eliminate deadlocks.",
        ],
      },
    },
  ],
  data: [
    {
      id: "data-1",
      type: "Technical",
      question: "Explain the bias-variance tradeoff in machine learning and techniques used to mitigate overfitting in complex datasets.",
      hint: "Mention L1/L2 regularization, k-fold cross-validation, dropout, early stopping, and ensemble methods.",
      standardConcept: {
        title: "Bias-Variance Decomposition & Model Regularization",
        definition:
          "**Bias** represents error from erroneous assumptions (underfitting); **Variance** represents error from sensitivity to training set fluctuations (overfitting). Total generalization error equals $Bias^2 + Variance + Irreducible Error$. Overfitting is mitigated via L1/L2 weight penalties, dropout, k-fold cross-validation, data augmentation, and bagging ensemble models.",
        keyTakeaways: [
          "High bias models miss relevant relations (underfit); high variance models model noise (overfit).",
          "L1 (Lasso) promotes sparsity/feature selection; L2 (Ridge) shrinks weights smoothly.",
          "Ensemble methods (Random Forests, Gradient Boosting) reduce variance and bias respectively.",
        ],
      },
    },
    {
      id: "data-2",
      type: "System Design",
      question: "How would you design a real-time feature store and model evaluation pipeline for streaming fraud detection predictions?",
      hint: "Discuss Kafka/Pulsar stream ingestion, low-latency Redis/Feast feature stores, and drift detection metrics.",
      standardConcept: {
        title: "Real-Time Streaming Feature Store & MLOps Architecture",
        definition:
          "Real-time fraud scoring pipelines ingest events via Apache Kafka/Flink, compute point-in-time streaming aggregations, and synchronize them into a low-latency key-value feature store (Redis/Feast). Models serve inference via gRPC with async Kafka logging for statistical data drift (PSI) and concept drift monitoring.",
        keyTakeaways: [
          "Feature stores decouple online low-latency lookup (<10ms) from offline batch training parity.",
          "Point-in-time correctness prevents data leakage during training set generation.",
          "Continuous Population Stability Index (PSI) monitoring catches distribution drift in production.",
        ],
      },
    },
    {
      id: "data-3",
      type: "Behavioral",
      question: "Tell me about a data project where the initial analysis contradicted the stakeholder's assumptions. How did you communicate the findings?",
      hint: "Structure your answer with objective data visualization, hypothesis testing, and constructive recommendation storytelling.",
      standardConcept: {
        title: "Data-Driven Stakeholder Alignment & Hypothesis Validation",
        definition:
          "Presenting counter-intuitive findings requires framing discoveries as collaborative value discovery. Validate the analytical methodology with statistical confidence intervals, rule out confounding variables, visualize trends clearly, and propose actionable, testable experiments.",
        keyTakeaways: [
          "Focus on shared business goals rather than proving previous assumptions wrong.",
          "Provide transparent methodology, p-values, and sensitivity analyses.",
          "Pivot findings into concrete next steps or A/B validation tests.",
        ],
      },
    },
  ],
  product: [
    {
      id: "prod-1",
      type: "Behavioral",
      question: "How do you prioritize competing feature requests from high-value enterprise customers versus engineering technical debt?",
      hint: "Use RICE scoring (Reach, Impact, Confidence, Effort), customer impact matrices, and data-backed validation.",
      standardConcept: {
        title: "Product Prioritization Frameworks & Strategic Alignment",
        definition:
          "Prioritizing competing demands uses quantitative frameworks like **RICE** $(Reach \\times Impact \\times Confidence / Effort)$ balanced against strategic OKRs. Enterprise requests are evaluated for broader multi-tenant product market fit, while technical debt is evaluated against SLA impact and engineering velocity loss.",
        keyTakeaways: [
          "Distinguish bespoke one-off requests from scalable platform capabilities.",
          "Quantify technical debt in terms of system reliability and developer cycle time.",
          "Communicate roadmap tradeoffs transparently to executive stakeholders.",
        ],
      },
    },
    {
      id: "prod-2",
      type: "System Design",
      question: "Walk me through how you would design and launch a new user onboarding flow for a B2B SaaS platform to boost 30-day retention.",
      hint: "Discuss time-to-value, interactive checklists, in-app micro-milestones, and cohort retention metrics.",
      standardConcept: {
        title: "B2B SaaS Product-Led Onboarding & Time-To-Value (TTV)",
        definition:
          "Effective onboarding minimizes Time-to-Value (TTV) by guiding the user to their initial 'Aha!' moment through interactive checklists, sample starter templates, progressive profile completion, and automated email nudges triggered by event milestone drop-offs.",
        keyTakeaways: [
          "Map the critical activation milestone that correlates with long-term 30-day retention.",
          "Use progressive disclosure to avoid cognitive overload during signup.",
          "Track cohort retention curves across acquisition channels.",
        ],
      },
    },
    {
      id: "prod-3",
      type: "Technical",
      question: "How do you define success metrics and guardrail metrics for an A/B test when launching an algorithmic recommendation feed?",
      hint: "Mention primary conversion rate, p-values/statistical significance, and guardrails like bounce rate and page latency.",
      standardConcept: {
        title: "A/B Experimentation Design & Guardrail Metrics",
        definition:
          "Experimentation architectures require defining a Primary Metric (e.g. Content Engagement / Click-Through Rate), Secondary Metrics (e.g. Session Duration, Discovery Diversity), and **Guardrail Metrics** (e.g. 99th percentile API latency, unsubscribe rate, app crash rate). Tests run until reaching statistical power (typically 95% significance level, $p < 0.05$).",
        keyTakeaways: [
          "Guardrail metrics prevent optimizing short-term clicks at the expense of system health or trust.",
          "Pre-determine sample size and duration to avoid peeking bias.",
          "Verify sample ratio mismatch (SRM) to ensure randomization integrity.",
        ],
      },
    },
  ],
  design: [
    {
      id: "des-1",
      type: "Technical",
      question: "How do you structure and maintain a scalable design system in Figma to ensure consistency between design tokens and frontend CSS code?",
      hint: "Discuss atomic design principles, component variants, auto layout 5.0, design tokens, and semantic color palettes.",
      standardConcept: {
        title: "Design Token Architecture & Component Scalability",
        definition:
          "Scalable design systems organize tokens into a 3-tier hierarchy: Global/Raw Tokens (hex codes, base pixel scales), Semantic/Alias Tokens (`color.surface.primary`, `spacing.sm`), and Component-Specific Tokens. Components leverage Figma component properties, nested variants, and auto-layout rules mirrored into CSS variables or Tailwind tokens.",
        keyTakeaways: [
          "Semantic tokens enable seamless theme switching (dark/light mode) without altering component definitions.",
          "Design system components must enforce strict accessibility contrast ratios (WCAG 2.1 AA).",
          "Automate token export to JSON using tools like Style Dictionary for zero-drift frontend synchronization.",
        ],
      },
    },
    {
      id: "des-2",
      type: "Behavioral",
      question: "Describe a project where user research findings directly challenged your initial UI concept. How did you iterate on the solution?",
      hint: "Detail usability testing methodology, synthesis of user friction points, and iterative wireframe validation.",
      standardConcept: {
        title: "Iterative UX Research Synthesis & Design Validation",
        definition:
          "User-centered design relies on continuous discovery: conducting qualitative usability walkthroughs, identifying friction patterns in task completion, synthesizing findings into affinity maps, and rapidly prototyping lower-fidelity alternatives to validate mental models before final engineering handoff.",
        keyTakeaways: [
          "Treat initial designs as testable hypotheses rather than precious outputs.",
          "Look for underlying behavioral friction rather than superficial aesthetic feedback.",
          "Iterate from low-fidelity wireframes to high-fidelity interactive prototypes.",
        ],
      },
    },
    {
      id: "des-3",
      type: "System Design",
      question: "How do you design for accessibility (WCAG 2.1 AA) in complex web applications with high information density?",
      hint: "Cover color contrast ratios, screen reader ARIA landmarks, keyboard tab navigation, and focus state visibility.",
      standardConcept: {
        title: "WCAG 2.1 AA Accessibility & Inclusive Information Architecture",
        definition:
          "Designing for high-density accessibility requires: minimum 4.5:1 text contrast (3:1 for large UI controls), visible non-color indicators for states (icons alongside color changes), clear tab order and visible keyboard focus rings (`:focus-visible`), and semantic ARIA landmark regions for screen reader navigation.",
        keyTakeaways: [
          "Never rely on color alone to convey error or active states.",
          "Ensure interactive controls have minimum touch targets of 44x44 CSS pixels.",
          "Support browser zoom up to 200% without loss of content or functionality.",
        ],
      },
    },
  ],
  devops: [
    {
      id: "dev-1",
      type: "Technical",
      question: "Explain the architecture of Kubernetes: how do the Control Plane components (API server, etcd, scheduler) orchestrate worker node pods?",
      hint: "Discuss reconciliation loops, declarative state in etcd, kubelet node agents, and service discovery.",
      standardConcept: {
        title: "Kubernetes Control Plane & Declarative State Reconciliation",
        definition:
          "The Kubernetes Control Plane maintains declared cluster state stored in distributed **etcd**. The `kube-apiserver` acts as the single gateway, while the `kube-scheduler` assigns unscheduled pods to nodes based on affinity/resources. Controllers run continuous reconciliation loops to match actual state with desired state. Worker nodes run `kubelet` (pod lifecycle) and `kube-proxy` (networking rules).",
        keyTakeaways: [
          "Declarative state in etcd guarantees desired state convergence regardless of transient failures.",
          "Kubelet communicates with the container runtime (containerd/CRI-O) to spawn pods.",
          "Service discovery and load balancing are managed via CoreDNS and kube-proxy iptables/IPVS.",
        ],
      },
    },
    {
      id: "dev-2",
      type: "System Design",
      question: "Design a zero-downtime blue-green or canary deployment pipeline for a high-availability microservice on AWS.",
      hint: "Mention ALB weighted routing, health check gates, automated rollbacks, and database schema migrations.",
      standardConcept: {
        title: "Zero-Downtime Canary & Blue-Green Deployment Pipelines",
        definition:
          "Zero-downtime pipelines deploy new versions alongside existing instances. **Canary routing** shifts 5% $\\rightarrow$ 25% $\\rightarrow$ 100% of traffic via Application Load Balancer / service mesh weighted targets, monitoring Prometheus error rate/latency metrics. Any threshold breach triggers instant automated rollback. Database migrations must follow non-breaking expand-contract patterns.",
        keyTakeaways: [
          "Canary gates evaluate real production metrics before full traffic cutover.",
          "Database changes must be backward-compatible (add columns before writing, drop after old version deprecation).",
          "Automated health check probes prevent routing traffic to initializing pods.",
        ],
      },
    },
    {
      id: "dev-3",
      type: "Behavioral",
      question: "Tell me about a critical production outage or security incident you managed. What was your triage protocol and post-mortem process?",
      hint: "Detail immediate incident response, communication channels, root cause analysis (5 Whys), and preventative action items.",
      standardConcept: {
        title: "Blameless Incident Management & Root Cause Analysis (5 Whys)",
        definition:
          "Production incident protocols follow strict phases: Detection & Paging, Incident Commander assignment, containment/rollback (prioritizing customer mitigation over deep debugging), transparent status updates, and a **blameless post-mortem** with 5-Whys root cause analysis producing actionable automated preventive Jira tickets.",
        keyTakeaways: [
          "First priority in an outage is mitigating customer impact (rollback/circuit break), not writing fixes.",
          "Blameless culture focuses on system vulnerabilities rather than human error.",
          "Every post-mortem must generate trackable preventive engineering tasks with SLA ownership.",
        ],
      },
    },
  ],
};

const externalPracticeTools = [
  {
    name: "Codédex",
    role: "Core Curriculum",
    description: "Gamified, quest-based coding practice with visual progression and fundamentals.",
    url: "https://www.codedex.io/",
  },
  {
    name: "Codepip",
    role: "Interactive Drills",
    description: "Bite-sized coding games that build specific CSS layout, flexbox, and JS skills.",
    url: "https://codepip.com/",
  },
  {
    name: "System Design Primer",
    role: "Architecture Guide",
    description: "Comprehensive open-source repository for scaling systems and acing engineering interviews.",
    url: "https://github.com/donnemartin/system-design-primer",
  },
];

const STORAGE_SCORE_KEY = "careerforge.practice_scorecard";

export function PracticeHub() {
  const { user } = useApp();
  const role = user?.targetRole || "frontend";
  const questions = PRACTICE_QUESTIONS[role] || PRACTICE_QUESTIONS.frontend;

  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [speakingQuestion, setSpeakingQuestion] = useState(false);
  const [vocalizingExplanation, setVocalizingExplanation] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [explanationOutput, setExplanationOutput] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);

  const speechControllerRef = useRef<SpeechRecognitionController | null>(null);
  const speechBaseTextRef = useRef<string>("");
  const activeQuestion = questions[activeQuestionIdx] || questions[0];

  // Load completed questions from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SCORE_KEY);
      if (raw) setCompletedIds(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  // Cleanup speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      speechControllerRef.current?.stop();
    };
  }, []);

  // Vocalize Question Text
  const handleReadQuestion = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported in this browser.");
      return;
    }

    if (speakingQuestion) {
      window.speechSynthesis.cancel();
      setSpeakingQuestion(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = activeQuestion.question;
    const utterance = new SpeechSynthesisUtterance(`Question: ${cleanText}`);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setSpeakingQuestion(true);
    utterance.onend = () => setSpeakingQuestion(false);
    utterance.onerror = () => setSpeakingQuestion(false);

    window.speechSynthesis.speak(utterance);
  };

  // Vocalize Explanation Text (SpeechSynthesisUtterance)
  const handleReadExplanation = (textToRead: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported in this browser.");
      return;
    }

    if (vocalizingExplanation) {
      window.speechSynthesis.cancel();
      setVocalizingExplanation(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = textToRead
      .replace(/\*\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/[•\-\*]\s/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setVocalizingExplanation(true);
    utterance.onend = () => setVocalizingExplanation(false);
    utterance.onerror = () => setVocalizingExplanation(false);

    window.speechSynthesis.speak(utterance);
  };

  // Toggle Voice Dictation without duplicate transcript echo
  const handleToggleListening = () => {
    if (listening) {
      speechControllerRef.current?.stop();
      setListening(false);
      return;
    }

    speechBaseTextRef.current = userAnswer.trim();

    const controller = startSpeechRecognition({
      lang: "en-US",
      onTranscript: (transcript: string) => {
        const base = speechBaseTextRef.current;
        const combined = base ? `${base} ${transcript}` : transcript;
        setUserAnswer(combined);
      },
      onListeningChange: (isList: boolean) => setListening(isList),
      onError: () => setListening(false),
    });
    speechControllerRef.current = controller;
  };

  // Explanation Heuristic: Outputs an objective, standardized definition of the correct concept
  const handleEvaluate = async () => {
    if (!userAnswer.trim() || evaluating) return;
    setEvaluating(true);
    setExplanationOutput(null);

    const standardDef = activeQuestion.standardConcept;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Please provide an objective, standardized technical breakdown of this interview concept.\n\nQuestion: "${activeQuestion.question}"\n\nStandard Topic: "${standardDef.title}"\n\nProvide the explanation in structured markdown format with:\n- **Standard Technical Definition**\n- **Core Principles & Architectural Trade-Offs**\n- **Production Best Practices**\n\nOutput only the objective standard concept definition rather than grading the user's specific text.`,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || "";
        if (reply.length > 50) {
          setExplanationOutput(reply);
        } else {
          setExplanationOutput(
            `### **${standardDef.title}**\n\n**Standard Definition:**\n${standardDef.definition}\n\n**Key Takeaways & Production Principles:**\n${standardDef.keyTakeaways.map((k) => `• ${k}`).join("\n")}`
          );
        }
      } else {
        setExplanationOutput(
          `### **${standardDef.title}**\n\n**Standard Definition:**\n${standardDef.definition}\n\n**Key Takeaways & Production Principles:**\n${standardDef.keyTakeaways.map((k) => `• ${k}`).join("\n")}`
        );
      }
    } catch {
      setExplanationOutput(
        `### **${standardDef.title}**\n\n**Standard Definition:**\n${standardDef.definition}\n\n**Key Takeaways & Production Principles:**\n${standardDef.keyTakeaways.map((k) => `• ${k}`).join("\n")}`
      );
    } finally {
      setEvaluating(false);

      // Mark question completed
      const updated = { ...completedIds, [activeQuestion.id]: true };
      setCompletedIds(updated);
      try {
        localStorage.setItem(STORAGE_SCORE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  };

  const handleNextQuestion = () => {
    if (activeQuestionIdx === questions.length - 1) {
      // Finished the final question
      setIsQuizCompleted(true);
    } else {
      setActiveQuestionIdx((prev) => prev + 1);
      setUserAnswer("");
      setExplanationOutput(null);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingQuestion(false);
      setVocalizingExplanation(false);
    }
  };

  const handleRestartQuiz = () => {
    setIsQuizCompleted(false);
    setActiveQuestionIdx(0);
    setUserAnswer("");
    setExplanationOutput(null);
  };

  const completedCount = Object.keys(completedIds).filter((id) =>
    questions.some((q) => q.id === id)
  ).length;

  return (
    <Section
      id="practice"
      eyebrow="Interview Simulator"
      title="Standard Concept Practice &amp; Knowledge Verification"
      description="Practice core technical, behavioral, and system design concepts with speech recognition, audio synthesis, and standardized definitions."
    >
      {/* ─── QUIZ COMPLETION GLOBAL SUMMARY VIEW ─────────────────────────── */}
      {isQuizCompleted ? (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-200 pb-5">
              <div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  ✓ Quiz Completed
                </span>
                <h3 className="font-display text-2xl italic text-neutral-900 mt-2">
                  Global Concept Summary: {role.toUpperCase()} Track
                </h3>
                <p className="text-xs text-neutral-600 mt-1">
                  Comprehensive reference guide of all standard industry definitions and architectural principles tested in this session.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <PrimaryButton type="button" onClick={handleRestartQuiz} className="text-xs">
                  ↺ Practice Again
                </PrimaryButton>
              </div>
            </div>

            {/* Global Summary of Tested Concepts */}
            <div className="mt-6 space-y-5">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-line bg-white p-5 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-xs font-bold text-neutral-900 uppercase">
                        {q.standardConcept.title}
                      </span>
                    </div>
                    <Tag>{q.type}</Tag>
                  </div>

                  <p className="text-xs font-medium text-neutral-500 italic">
                    &ldquo;{q.question}&rdquo;
                  </p>

                  <div className="rounded-lg bg-neutral-50 p-3.5 text-xs text-neutral-800 leading-relaxed space-y-2 border border-neutral-200/80">
                    <p className="font-semibold text-neutral-900">Standard Concept Definition:</p>
                    <div className="prose prose-sm max-w-none text-neutral-700 font-sans">
                      <ReactMarkdown>
                        {q.standardConcept.definition}
                      </ReactMarkdown>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      Key Takeaways &amp; Architectural Standards:
                    </p>
                    <ul className="list-disc pl-4 text-xs text-neutral-600 space-y-0.5">
                      {q.standardConcept.keyTakeaways.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ─── ACTIVE QUESTION DRILL VIEW ──────────────────────────────────── */
        <div>
          {/* Session Progress Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white px-5 py-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white font-bold text-xs">
                {activeQuestionIdx + 1}/{questions.length}
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">Active Question Drill</p>
                <p className="text-[11px] text-graphite">
                  Target Role: <strong className="capitalize text-neutral-900">{role}</strong> ({completedCount} Completed)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setActiveQuestionIdx(idx);
                    setUserAnswer("");
                    setExplanationOutput(null);
                    if (typeof window !== "undefined" && "speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                    }
                    setSpeakingQuestion(false);
                    setVocalizingExplanation(false);
                  }}
                  className={`h-7 w-7 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeQuestionIdx === idx
                      ? "bg-neutral-900 text-white ring-2 ring-neutral-400"
                      : completedIds[q.id]
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-200"
                  }`}
                  title={`Question ${idx + 1}: ${q.type}`}
                >
                  {completedIds[q.id] ? "✓" : idx + 1}
                </button>
              ))}

              <GhostButton
                type="button"
                onClick={() => setIsQuizCompleted(true)}
                className="text-xs ml-2 py-1 px-2.5 bg-neutral-50"
              >
                Global Summary →
              </GhostButton>
            </div>
          </div>

          {/* Main Question Card */}
          <div className="mb-10 rounded-2xl border border-neutral-300 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Tag>{activeQuestion.type}</Tag>
                <span className="text-xs font-semibold text-graphite uppercase tracking-wider">
                  Question {activeQuestionIdx + 1} of {questions.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Click to Hear Question Aloud */}
                <button
                  type="button"
                  onClick={handleReadQuestion}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    speakingQuestion
                      ? "bg-neutral-900 text-white animate-pulse"
                      : "bg-mist text-graphite hover:bg-neutral-200 hover:text-ink"
                  }`}
                  title="Read question aloud (Speech Synthesis)"
                >
                  <span>{speakingQuestion ? "⏹ Stop Audio" : "🔊 Listen to Question"}</span>
                </button>

                {/* Question Switcher */}
                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-graphite hover:border-ink hover:text-ink transition-colors cursor-pointer"
                >
                  {activeQuestionIdx === questions.length - 1 ? "Finish & Summary →" : "Next Question →"}
                </button>
              </div>
            </div>

            {/* Question Title */}
            <h3 className="font-display text-lg sm:text-xl italic text-ink leading-relaxed">
              &ldquo;{activeQuestion.question}&rdquo;
            </h3>
            <p className="mt-2 text-xs text-graphite bg-mist/60 p-2.5 rounded-lg border border-line/60">
              💡 <strong>Standard Focus:</strong> {activeQuestion.hint}
            </p>

            {/* User Answer Textarea & Voice Input */}
            <div className="mt-5 space-y-3">
              <div className="relative">
                <textarea
                  rows={4}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Record your response via voice dictation or type your thoughts here..."
                  className="w-full rounded-xl border border-line bg-mist/30 p-3.5 text-sm text-ink placeholder:text-graphite/60 focus:border-ink focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Voice Dictation Button */}
                <button
                  type="button"
                  onClick={handleToggleListening}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                    listening
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-mist text-ink hover:bg-line"
                  }`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${listening ? "bg-white animate-ping" : "bg-red-500"}`} />
                  <span>{listening ? "Recording... Click to Stop" : "🎙️ Voice Input (Speech-to-Text)"}</span>
                </button>

                {/* Reveal Standard Explanation Button */}
                <PrimaryButton
                  type="button"
                  onClick={handleEvaluate}
                  disabled={evaluating || !userAnswer.trim()}
                >
                  {evaluating ? "Generating Concept Explanation…" : "Reveal Standard Concept Explanation"}
                </PrimaryButton>
              </div>
            </div>

            {/* Objective Concept Explanation Output */}
            {explanationOutput && (
              <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/90 p-5 text-xs leading-relaxed text-ink space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-bold text-neutral-900 text-sm">Objective Concept Explanation</span>
                  </div>

                  {/* SpeechSynthesis Vocalization Button */}
                  <button
                    type="button"
                    onClick={() => handleReadExplanation(explanationOutput)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      vocalizingExplanation
                        ? "bg-neutral-900 text-white animate-pulse"
                        : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span>{vocalizingExplanation ? "⏹ Stop Vocalization" : "🔊 Vocalize Explanation"}</span>
                  </button>
                </div>

                {/* Formatted Markdown Rendering without Escaped Asterisks */}
                <div className="prose prose-sm max-w-none text-neutral-800 pt-1 font-sans">
                  <ReactMarkdown
                    components={{
                      strong: ({ ...props }) => (
                        <strong className="font-bold text-neutral-950" {...props} />
                      ),
                      h3: ({ ...props }) => (
                        <h3 className="font-bold text-sm text-neutral-900 mt-2 mb-1" {...props} />
                      ),
                      ul: ({ ...props }) => (
                        <ul className="list-disc pl-4 space-y-1 my-2" {...props} />
                      ),
                      p: ({ ...props }) => (
                        <p className="mb-2 leading-relaxed" {...props} />
                      ),
                    }}
                  >
                    {explanationOutput}
                  </ReactMarkdown>
                </div>

                <div className="flex justify-end pt-3 border-t border-neutral-200">
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 transition-all cursor-pointer"
                  >
                    {activeQuestionIdx === questions.length - 1 ? "Finish Quiz & View Summary →" : "Proceed to Next Concept →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gamified Coding Environments & Reference Sandboxes */}
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-graphite">
        External Practice Environments &amp; Reference Sandboxes
      </h4>
      <div className="grid gap-4 sm:grid-cols-3">
        {externalPracticeTools.map((tool) => (
          <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer">
            <Card className="h-full transition-colors hover:border-ink">
              <p className="text-xs font-medium uppercase tracking-wide text-graphite">
                {tool.role}
              </p>
              <p className="mt-2 font-display text-xl italic text-ink">{tool.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-graphite">
                {tool.description}
              </p>
              <p className="mt-4 text-xs font-medium text-ink underline decoration-line underline-offset-4">
                Launch Sandbox →
              </p>
            </Card>
          </a>
        ))}
      </div>
    </Section>
  );
}
