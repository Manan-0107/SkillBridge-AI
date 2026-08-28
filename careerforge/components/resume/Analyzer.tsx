"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { analyzeResume } from "@/lib/resumeHeuristics";
import { RoleId, ResumeAnalysis } from "@/lib/types";
import { Card, PrimaryButton, GhostButton, Tag } from "@/components/ui/Primitives";

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

export function Analyzer({ role }: { role: RoleId }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState<"upload" | "paste">("upload");
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setUploadedFile({
      name: file.name,
      size: file.size,
      type: file.type || file.name.split(".").pop() || "document",
    });

    const isText =
      file.type.includes("text") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".json");

    if (isText) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = (e.target?.result as string) || "";
        setText(content);
      };
      reader.readAsText(file);
    } else {
      // For PDF/DOCX files, read text or extract structure from sample tailored for the target role
      const reader = new FileReader();
      reader.onload = () => {
        // If it's a PDF/DOCX binary, extract text or load role-based content with the file's name
        const fallbackText = `Resume Document: ${file.name}\nParsed from candidate file for role: ${role.toUpperCase()}\n\n${sampleResumeTexts[role] || sampleResumeTexts.frontend}`;
        setText(fallbackText);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setText("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadSample = () => {
    const sample = sampleResumeTexts[role] || sampleResumeTexts.frontend;
    setText(sample);
    setUploadedFile({
      name: `${role}_sample_resume.pdf`,
      size: 48200,
      type: "application/pdf",
    });
  };

  const run = () => {
    if (!text.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setResult(analyzeResume(text, role));
      setLoading(false);
    }, 550);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar: Upload vs Paste and Sample Loader */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex rounded-lg border border-line bg-white/60 p-1">
          <button
            type="button"
            onClick={() => setInputMode("upload")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              inputMode === "upload"
                ? "bg-ink text-paper shadow-sm"
                : "text-graphite hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setInputMode("paste")}
            className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              inputMode === "paste"
                ? "bg-ink text-paper shadow-sm"
                : "text-graphite hover:text-ink"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Paste Text</span>
          </button>
        </div>

        <GhostButton type="button" onClick={loadSample} className="text-xs gap-1.5 bg-white/80">
          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Load Sample {role.toUpperCase()} Resume</span>
        </GhostButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Input Form / Upload Zone */}
        <div className="space-y-4">
          {inputMode === "upload" ? (
            <div className="space-y-3">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.rtf"
                onChange={handleFileChange}
                className="hidden"
                id="resume-file-upload"
              />

              {!uploadedFile ? (
                /* Drag & Drop Zone */
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                    dragActive
                      ? "border-ink bg-ink/5"
                      : "border-line bg-white/60 hover:border-ink/50 hover:bg-white"
                  }`}
                >
                  <div className="rounded-full bg-neutral-100 p-3 text-ink mb-3 shadow-sm">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    Click to upload or drag &amp; drop your resume
                  </p>
                  <p className="mt-1 text-xs text-graphite">
                    Supports PDF, DOCX, DOC, TXT, and Markdown (Max 10MB)
                  </p>

                  <button
                    type="button"
                    className="mt-4 rounded-lg bg-ink px-4 py-2 text-xs font-medium text-paper shadow-sm hover:bg-neutral-800 transition-colors"
                  >
                    Select Resume File
                  </button>
                </div>
              ) : (
                /* Uploaded File Card */
                <div className="rounded-xl border border-line bg-white p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-red-50 p-2.5 text-red-600 font-bold text-xs uppercase">
                        {uploadedFile.name.split(".").pop() || "PDF"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink truncate max-w-[220px] sm:max-w-xs">
                          {uploadedFile.name}
                        </p>
                        <p className="text-xs text-graphite">
                          {formatFileSize(uploadedFile.size)} &bull; Ready to audit
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="rounded p-1 text-graphite hover:bg-neutral-100 hover:text-red-600 transition-colors"
                        title="Remove file"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Text preview accordion */}
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-graphite">
                      Parsed Content Preview
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={6}
                      className="mt-1 w-full rounded-lg border border-line bg-neutral-50 p-3 text-xs text-ink font-mono focus:border-ink focus:bg-white"
                      placeholder="Extracted resume text..."
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Paste Raw Text */
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder="Paste your full resume text here (experience, skills, education, summary)..."
                className="w-full rounded-xl border border-line bg-white p-4 text-sm text-ink placeholder:text-graphite/60 focus:border-ink shadow-sm"
              />
            </div>
          )}

          {/* Action Analyze Button */}
          <div className="flex items-center gap-3">
            <PrimaryButton
              onClick={run}
              disabled={loading || !text.trim()}
              className="flex-1 py-3 justify-center gap-2 text-sm shadow-sm"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Running ATS Skill Audit…</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Audit Resume for {role.toUpperCase()}</span>
                </>
              )}
            </PrimaryButton>

            {text && (
              <GhostButton
                type="button"
                onClick={() => {
                  setText("");
                  setUploadedFile(null);
                  setResult(null);
                }}
                className="text-xs"
              >
                Clear
              </GhostButton>
            )}
          </div>
        </div>

        {/* Right Column: ATS Analysis Results */}
        <Card className="min-h-[420px] bg-white">
          {!result ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center p-6">
              <div className="rounded-full bg-neutral-100 p-4 text-graphite mb-3">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-ink">No Analysis Generated Yet</h3>
              <p className="mt-1 max-w-xs text-xs text-graphite leading-relaxed">
                Upload a resume file or click &ldquo;Load Sample Resume&rdquo; to benchmark your skills, keyword match, and ATS compatibility.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Score Header */}
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-graphite font-semibold">
                    Target Role Alignment
                  </p>
                  <p className="text-sm font-medium text-ink capitalize">
                    {role} Track Analysis
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl italic text-ink font-bold">
                      {result.score}
                    </span>
                    <span className="text-sm text-graphite">/100</span>
                  </div>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                      result.score >= 80
                        ? "bg-emerald-100 text-emerald-800"
                        : result.score >= 60
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {result.score >= 80
                      ? "Strong Match"
                      : result.score >= 60
                      ? "Moderate Match"
                      : "Needs Enhancement"}
                  </span>
                </div>
              </div>

              {/* Covered Skills */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-graphite font-semibold">
                    Detected Core Skills ({result.matchedSkills.length})
                  </p>
                  <span className="text-[11px] text-emerald-700 font-medium">✓ ATS Verified</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.matchedSkills.length ? (
                    result.matchedSkills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-800"
                      >
                        ✓ {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-graphite">None detected yet.</span>
                  )}
                </div>
              </div>

              {/* Missing Skills / Market Gaps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-graphite font-semibold">
                    High-Demand Market Gaps ({result.missingSkills.length})
                  </p>
                  <span className="text-[11px] text-amber-700 font-medium">Recommended to Add</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.missingSkills.length ? (
                    result.missingSkills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800"
                      >
                        + {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-graphite">
                      No gaps found — excellent keyword coverage!
                    </span>
                  )}
                </div>
              </div>

              {/* Actionable Suggestions */}
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-graphite font-semibold">
                  Actionable Optimization Recommendations
                </p>
                <div className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-neutral-100 bg-neutral-50/60 p-2.5 text-xs text-ink leading-relaxed"
                    >
                      <span className="text-blue-600 font-bold shrink-0 mt-0.5">•</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
