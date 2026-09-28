"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import { RoleId, ResumeAnalysis, EnhancedAnalysis } from "@/lib/types";

const sampleResumeTexts: Record<RoleId, string> = {
  frontend: `ALEX RIVERA
alex.rivera@email.com • (555) 019-2834 • San Francisco, CA • linkedin.com/in/alexrivera • github.com/alexrivera

PROFESSIONAL SUMMARY
Dynamic Frontend Engineer with 4+ years of experience building high-performance web applications using React, TypeScript, Next.js, and Tailwind CSS. Passionate about UI/UX performance, responsive design, state management with Redux, and accessible web standards (WCAG).

WORK EXPERIENCE
Senior Frontend Developer | TechForge Labs | 2022 – Present
• Architected and developed core client-facing dashboard in Next.js and TypeScript, improving page load performance by 42%.
• Built reusable component library using React, Tailwind CSS, and Storybook adopted across 6 cross-functional engineering teams.
• Implemented end-to-end testing with Jest and Cypress, achieving 88% unit test coverage and eliminating critical UI regressions.

Frontend Engineer | CloudScale Solutions | 2020 – 2022
• Developed interactive SaaS interfaces using React, JavaScript (ES6+), HTML5, and CSS3/SASS.
• Integrated RESTful APIs and GraphQL endpoints for real-time analytics data streaming.
• Optimized Core Web Vitals (LCP, FID, CLS), boosting organic SEO traffic and user engagement by 28%.

EDUCATION & SKILLS
B.S. in Computer Science — California State University (2016 – 2020)
Core Skills: React, Next.js, TypeScript, JavaScript, HTML5, CSS3, Tailwind CSS, Redux, REST APIs, Git, Jest, CI/CD, Responsive Design.`,

  backend: `JORDAN CHEN
jordan.chen@email.com • (555) 234-5678 • Seattle, WA • github.com/jordanchen • linkedin.com/in/jordanchen

PROFESSIONAL SUMMARY
Backend Engineer with 5 years of experience designing scalable microservices, RESTful APIs, and database architectures using Node.js, Python, PostgreSQL, Redis, and Docker.

WORK EXPERIENCE
Backend Software Engineer | DataGrid Inc | 2021 – Present
• Designed distributed microservices using Node.js, Express, and PostgreSQL handling 15M+ daily API requests.
• Implemented Redis caching layer reducing database query latency by 65%.
• Deployed microservices on AWS (ECS, S3, RDS) using Docker and Terraform CI/CD pipelines.

Software Developer | ByteWorks | 2019 – 2021
• Developed REST APIs in Python/Django and integrated PostgreSQL databases.
• Wrote comprehensive unit tests in PyTest with 90% code coverage.

EDUCATION & SKILLS
B.S. in Software Engineering — University of Washington (2015 – 2019)
Core Skills: Node.js, Python, PostgreSQL, MySQL, Redis, Docker, AWS, REST APIs, Microservices, Git, Linux, CI/CD.`,

  data: `MORGAN PATEL
morgan.patel@email.com • (555) 345-6789 • New York, NY • github.com/morganpatel

PROFESSIONAL SUMMARY
Data Scientist / ML Engineer with 3+ years experience building predictive models, data pipelines, and analytics solutions using Python, SQL, Pandas, Scikit-Learn, and TensorFlow.

WORK EXPERIENCE
Data Scientist | FinMetric Analytics | 2022 – Present
• Built churn prediction and customer segmentation machine learning models with 91% accuracy using XGBoost and Scikit-Learn.
• Automated ETL pipelines in Python and SQL processing 2TB of monthly transaction data.

Data Analyst | Insight Hub | 2020 – 2022
• Created interactive Tableau dashboards and conducted A/B testing analysis for product teams.
• Queried relational databases using complex SQL joins and window functions.

EDUCATION & SKILLS
M.S. in Data Science — NYU (2020) | B.S. in Statistics (2018)
Core Skills: Python, SQL, Pandas, NumPy, Scikit-Learn, TensorFlow, Machine Learning, Tableau, Power BI, Statistics, Git.`,

  product: `TAYLOR BROOKS
taylor.brooks@email.com • (555) 456-7890 • Austin, TX • linkedin.com/in/taylorbrooks

PROFESSIONAL SUMMARY
Product Manager with 4+ years of experience leading cross-functional engineering and design teams from concept to launch across B2B SaaS and consumer applications.

WORK EXPERIENCE
Product Manager | CloudScale Software | 2022 – Present
• Spearheaded product roadmap and feature prioritization for core enterprise analytics product, growing ARR by $2.4M.
• Conducted 50+ customer discovery interviews and defined PRDs, user stories, and acceptance criteria in Agile sprints.

Associate Product Manager | LaunchPad Tech | 2020 – 2022
• Managed user onboarding redesign, reducing time-to-value by 35% and increasing day-30 retention by 18%.
• Collaborated with UX researchers and data engineers to track engagement KPIs via Mixpanel and Amplitude.

SKILLS & EDUCATION
B.A. in Economics & Business — UT Austin (2016 – 2020)
Core Skills: Product Strategy, Roadmapping, Agile/Scrum, User Research, Wireframing, Data Analytics, PRD Writing, Jira, Mixpanel.`,

  design: `SAMIRA KHAN
samira.khan@email.com • (555) 567-8901 • Los Angeles, CA • samiradesigns.com • figma.com/@samira

PROFESSIONAL SUMMARY
Senior Product Designer / UX UI Designer with 5 years of experience creating intuitive web and mobile user interfaces, design systems, and user research workflows in Figma.

WORK EXPERIENCE
Senior Product Designer | Studio Aura | 2022 – Present
• Led design system architecture in Figma used across 4 web apps and 2 mobile apps, accelerating front-end sprint velocity by 30%.
• Conducted usability testing, wireframing, interactive prototyping, and user journey mapping for enterprise clients.

UI/UX Designer | PixelCraft Agency | 2019 – 2022
• Designed responsive web interfaces and mobile applications from wireframes to high-fidelity prototypes.
• Collaborated closely with front-end developers to ensure pixel-perfect CSS and accessibility standards (WCAG AA).

SKILLS & EDUCATION
B.F.A. in Interaction Design — ArtCenter College of Design (2015 – 2019)
Core Skills: Figma, UI/UX Design, Design Systems, Wireframing, Prototyping, Usability Testing, User Research, HTML/CSS basics.`,

  devops: `DAVID ZHANG
david.zhang@email.com • (555) 678-9012 • Chicago, IL • github.com/davidzhang-devops

PROFESSIONAL SUMMARY
DevOps & Cloud Infrastructure Engineer with 4+ years experience implementing CI/CD pipelines, Kubernetes clusters, Docker containerization, and AWS cloud architectures.

WORK EXPERIENCE
DevOps Engineer | Apex Cloud Systems | 2022 – Present
• Architected multi-region Kubernetes (EKS) infrastructure on AWS using Terraform and Helm charts.
• Built automated CI/CD pipelines in GitHub Actions, decreasing deployment cycle times from 45 minutes to 6 minutes.
• Configured Prometheus, Grafana, and ELK stack for infrastructure monitoring and 99.99% service uptime.

Systems & Cloud Engineer | NexaCorp | 2020 – 2022
• Managed AWS EC2, S3, RDS, and VPC networks; automated server provisioning via Ansible.
• Containerized legacy monolithic applications into Docker microservices.

SKILLS & EDUCATION
B.S. in Computer Information Systems — UIUC (2016 – 2020)
Core Skills: AWS, Docker, Kubernetes, Terraform, CI/CD, GitHub Actions, Linux/Bash, Python, Prometheus, Grafana, Ansible.`,
};

function verdict(score: number) {
  if (score >= 80) return "STRONG MATCH";
  if (score >= 60) return "MODERATE MATCH";
  return "NEEDS WORK";
}

export function Analyzer({ role }: { role: RoleId }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ResumeAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isText =
      file.type.includes("text") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md");

    if (isText) {
      setText(await file.text());
      return;
    }

    // PDF / DOCX → server-side extraction, fall back to role sample
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume/parse", { method: "POST", body: fd });
      const data = await res.json();
      setText(data.text || sampleResumeTexts[role] || "");
    } catch {
      setText(sampleResumeTexts[role] || "");
    }
  };

  const run = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Analysis failed (${res.status})`);

      const enhanced = data as EnhancedAnalysis;
      setResult({
        score: enhanced.overallScore,
        matchedSkills: enhanced.matchedSkills,
        missingSkills: enhanced.missingSkills,
        suggestions: enhanced.engines.ai.available
          ? enhanced.suggestions
          : ["AI scoring unavailable — showing keyword-overlap heuristic only. Set GEMINI_API_KEY or GITHUB_TOKEN for full analysis.", ...enhanced.suggestions],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // Voice command "analyze" (see context/VoiceContext.tsx) triggers a run once
  // this tab is mounted. No-ops on empty text, same as the button.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const onAction = (e: Event) => {
      if ((e as CustomEvent).detail?.action === "analyze") runRef.current();
    };
    window.addEventListener("careerforge:action", onAction);
    return () => window.removeEventListener("careerforge:action", onAction);
  }, []);

  return (
    <div className="grid grid-cols-1 rounded-2xl border border-ink/10 bg-surface/30 overflow-hidden lg:grid-cols-2">
      {/* ── Left: raw resume input ─────────────────────────────── */}
      <div className="border-b border-ink/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Resume Text · <span className="text-accent capitalize">{role}</span> Track
          </p>
          <span className="text-[11px] text-ink/40">Paste or upload</span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          placeholder="Paste your full resume text here — summary, work experience, technical skills, and education."
          className="w-full resize-y rounded-xl border border-ink/15 bg-bg p-4 text-xs sm:text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed"
          aria-label="Resume text to analyze"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md,.rtf"
          onChange={handleFileChange}
          className="hidden"
          id="analyzer-file-input"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-ink/15 bg-bg px-4 py-2 text-xs font-semibold text-ink hover:bg-surface hover:border-ink/25 transition-all cursor-pointer"
          >
            📎 Upload File
          </button>
          <button
            type="button"
            onClick={() => setText(sampleResumeTexts[role] || "")}
            className="rounded-lg border border-ink/15 bg-bg px-4 py-2 text-xs font-semibold text-ink hover:bg-surface hover:border-ink/25 transition-all cursor-pointer"
          >
            📝 Load Sample
          </button>
          <button
            type="button"
            onClick={run}
            disabled={!text.trim() || busy}
            className="ml-auto rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer shadow-xs"
          >
            {busy ? "Analyzing..." : "Analyze Match"}
          </button>
        </div>
      </div>

      {/* ── Right: match score ─────────────────────────────────── */}
      <div className="p-6 sm:p-8">
        {error ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs leading-relaxed text-danger">
            {error}
          </div>
        ) : !result ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-ink/12 bg-bg/50 p-6 text-center">
            <span className="text-2xl mb-2">📊</span>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">
              {busy ? "Analyzing skills against market data..." : "No analysis yet"}
            </p>
            <p className="mt-1 text-xs text-ink/50 max-w-xs">
              Paste your resume or click &quot;Load Sample&quot; and hit &quot;Analyze Match&quot; to inspect your ATS skill fit.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Score Banner */}
            <div className="rounded-xl border border-ink/10 bg-bg p-5 shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink/50">
                Market Match Score
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-sans text-5xl font-extrabold text-ink tabular-nums">
                  {result.score}
                </span>
                <span className="text-lg text-ink/40">/100</span>
                <span className="ml-auto rounded-full bg-surface border border-ink/10 px-3 py-1 text-xs font-bold text-accent">
                  {verdict(result.score)}
                </span>
              </div>
            </div>

            {/* Matched Skills */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-success">
                  Matched Skills ({result.matchedSkills.length})
                </p>
              </div>
              {result.matchedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.matchedSkills.map((s, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border border-success/25 bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
                    >
                      ✓ {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink/50">None detected.</p>
              )}
            </div>

            {/* Missing Skills */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-danger">
                  Missing Skills ({result.missingSkills.length})
                </p>
              </div>
              {result.missingSkills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.missingSkills.map((s, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border border-danger/25 bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger"
                    >
                      + {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-success font-medium">Full skill coverage detected!</p>
              )}
            </div>

            {/* Recommendations */}
            {result.suggestions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink/60">
                  Targeted Suggestions
                </p>
                <ul className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-ink/8 bg-bg p-3 text-xs leading-relaxed text-ink/75"
                    >
                      💡 {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
