"use client";

import { useState, useRef, ChangeEvent } from "react";
import { FieldLabel, GhostButton, PrimaryButton, inputClasses } from "@/components/ui/Primitives";
import { atsTemplates, AtsTemplate } from "@/app/api/resume/templates/route";

interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string;
}

interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  location: string;
  graduationYear: string;
  gpaOrHonors: string;
}

interface ProjectItem {
  id: string;
  title: string;
  techStack: string;
  liveUrl: string;
  repoUrl: string;
  description: string;
}

interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  linkOrId: string;
}

const initialExperience: ExperienceItem = {
  id: "exp-1",
  role: "Senior Frontend Engineer",
  company: "TechForge Labs",
  location: "San Francisco, CA (Remote)",
  startDate: "2022",
  endDate: "Present",
  current: true,
  bullets: "• Architected high-performance Next.js application, improving Core Web Vitals by 35%.\n• Spearheaded reusable TypeScript UI component library adopted across 5 product squads.\n• Mentored 4 junior engineers and implemented CI/CD test automation in GitHub Actions.",
};

const initialEducation: EducationItem = {
  id: "edu-1",
  degree: "B.S. in Computer Science",
  institution: "California State University",
  location: "Long Beach, CA",
  graduationYear: "2020",
  gpaOrHonors: "Magna Cum Laude • GPA 3.8/4.0",
};

const initialProject: ProjectItem = {
  id: "proj-1",
  title: "CloudFlow AI Dashboard",
  techStack: "React, Next.js, Tailwind CSS, OpenAI API, PostgreSQL",
  liveUrl: "https://cloudflow-demo.io",
  repoUrl: "https://github.com/alexrivera/cloudflow",
  description: "• Built real-time generative workflow builder processing 25K+ prompt requests daily.\n• Implemented optimistic UI updates and server-side streaming responses.",
};

const initialCertification: CertificationItem = {
  id: "cert-1",
  name: "AWS Certified Solutions Architect – Associate",
  issuer: "Amazon Web Services",
  date: "2023",
  linkOrId: "AWS-PSA-94821",
};

const popularSkills = [
  "React", "Next.js", "TypeScript", "JavaScript", "Node.js", "Python",
  "Tailwind CSS", "PostgreSQL", "GraphQL", "REST APIs", "AWS", "Docker",
  "Git / GitHub", "Jest / Cypress", "Figma", "Agile / Scrum"
];

const colorPalettes = [
  { id: "black", label: "Monochrome ATS", hex: "#111827", bgLight: "#F3F4F6", text: "#111827" },
  { id: "navy", label: "Midnight Navy", hex: "#1E3A8A", bgLight: "#EFF6FF", text: "#1E3A8A" },
  { id: "emerald", label: "Forest Emerald", hex: "#065F46", bgLight: "#ECFDF5", text: "#065F46" },
  { id: "indigo", label: "Royal Indigo", hex: "#4338CA", bgLight: "#EEF2FF", text: "#4338CA" },
  { id: "crimson", label: "Classic Crimson", hex: "#991B1B", bgLight: "#FEF2F2", text: "#991B1B" },
];

const fontOptions = [
  { id: "sans", label: "Inter (Modern Sans)", className: "font-sans" },
  { id: "serif", label: "Merriweather (Ivy Serif)", className: "font-serif" },
  { id: "mono", label: "JetBrains Mono (Technical)", className: "font-mono" },
];

export function Builder() {
  // Layout and Styling State
  const [selectedTemplate, setSelectedTemplate] = useState<AtsTemplate["id"]>("harvard");
  const [selectedColor, setSelectedColor] = useState(colorPalettes[0]);
  const [selectedFont, setSelectedFont] = useState(fontOptions[0]);
  const [density, setDensity] = useState<"compact" | "normal" | "spacious">("normal");

  // Personal Info
  const [fullName, setFullName] = useState("Alex Rivera");
  const [headline, setHeadline] = useState("Senior Frontend Engineer | React & TypeScript");
  const [email, setEmail] = useState("alex.rivera@example.com");
  const [phone, setPhone] = useState("+1 (555) 019-2834");
  const [location, setLocation] = useState("San Francisco, CA");
  const [linkedIn, setLinkedIn] = useState("linkedin.com/in/alexrivera");
  const [portfolio, setPortfolio] = useState("alexrivera.dev");
  const [github, setGithub] = useState("github.com/alexrivera");

  // Summary
  const [summary, setSummary] = useState(
    "Results-driven Frontend Engineer with 4+ years of expertise in building scalable, accessible, and high-performance web applications using React, TypeScript, Next.js, and modern cloud architectures. Proven track record in optimizing page speed and accelerating development velocity."
  );

  // Experience, Education, Skills, Projects, Certs
  const [experiences, setExperiences] = useState<ExperienceItem[]>([initialExperience]);
  const [educations, setEducations] = useState<EducationItem[]>([initialEducation]);
  const [skills, setSkills] = useState("React, Next.js, TypeScript, JavaScript, HTML5/CSS3, Tailwind CSS, Redux Toolkit, REST APIs, GraphQL, Jest, Cypress, Git, Docker, CI/CD");
  const [tools, setTools] = useState("VS Code, Figma, Postman, Jira, GitHub Actions, AWS S3/CloudFront");
  const [projects, setProjects] = useState<ProjectItem[]>([initialProject]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([initialCertification]);
  
  const [copied, setCopied] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [activeTab, setActiveTab] = useState<"layout" | "personal" | "experience" | "education" | "skills" | "projects" | "certs">("layout");
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Dedicated Print / Download PDF Handler
  const handleDownloadPdf = () => {
    const originalTitle = document.title;
    const sanitizedName = (fullName || "Candidate").replace(/[^a-zA-Z0-9_-]/g, "_");
    document.title = `${sanitizedName}_Resume`;

    window.print();

    // Restore title after print dialog closes
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Experience Handlers
  const addExperience = () => {
    setExperiences((prev) => [
      ...prev,
      {
        id: `exp-${Date.now()}`,
        role: "",
        company: "",
        location: "",
        startDate: "",
        endDate: "",
        current: false,
        bullets: "",
      },
    ]);
  };

  const updateExperience = (id: string, field: keyof ExperienceItem, val: string | boolean) => {
    setExperiences((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    );
  };

  const removeExperience = (id: string) => {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
  };

  // Education Handlers
  const addEducation = () => {
    setEducations((prev) => [
      ...prev,
      {
        id: `edu-${Date.now()}`,
        degree: "",
        institution: "",
        location: "",
        graduationYear: "",
        gpaOrHonors: "",
      },
    ]);
  };

  const updateEducation = (id: string, field: keyof EducationItem, val: string) => {
    setEducations((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    );
  };

  const removeEducation = (id: string) => {
    setEducations((prev) => prev.filter((e) => e.id !== id));
  };

  // Project Handlers
  const addProject = () => {
    setProjects((prev) => [
      ...prev,
      {
        id: `proj-${Date.now()}`,
        title: "",
        techStack: "",
        liveUrl: "",
        repoUrl: "",
        description: "",
      },
    ]);
  };

  const updateProject = (id: string, field: keyof ProjectItem, val: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  // Certification Handlers
  const addCertification = () => {
    setCertifications((prev) => [
      ...prev,
      {
        id: `cert-${Date.now()}`,
        name: "",
        issuer: "",
        date: "",
        linkOrId: "",
      },
    ]);
  };

  const updateCertification = (id: string, field: keyof CertificationItem, val: string) => {
    setCertifications((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  const removeCertification = (id: string) => {
    setCertifications((prev) => prev.filter((c) => c.id !== id));
  };

  const addSkillTag = (skill: string) => {
    if (!skills.toLowerCase().includes(skill.toLowerCase())) {
      setSkills((prev) => (prev ? `${prev}, ${skill}` : skill));
    }
  };

  const loadPresetData = () => {
    setFullName("Alex Rivera");
    setHeadline("Senior Frontend Engineer | React & TypeScript");
    setEmail("alex.rivera@example.com");
    setPhone("+1 (555) 019-2834");
    setLocation("San Francisco, CA");
    setLinkedIn("linkedin.com/in/alexrivera");
    setPortfolio("alexrivera.dev");
    setGithub("github.com/alexrivera");
    setSummary("Results-driven Frontend Engineer with 4+ years of expertise in building scalable, accessible, and high-performance web applications using React, TypeScript, Next.js, and modern cloud architectures.");
    setExperiences([initialExperience]);
    setEducations([initialEducation]);
    setSkills("React, Next.js, TypeScript, JavaScript, HTML5/CSS3, Tailwind CSS, Redux Toolkit, REST APIs, GraphQL, Jest, Cypress, Git, Docker, CI/CD");
    setTools("VS Code, Figma, Postman, Jira, GitHub Actions, AWS S3/CloudFront");
    setProjects([initialProject]);
    setCertifications([initialCertification]);
  };

  // JSONResume API Export
  const exportJsonResume = async () => {
    setExportingJson(true);
    try {
      const payload = {
        fullName,
        headline,
        email,
        phone,
        location,
        linkedIn,
        portfolio,
        github,
        summary,
        experiences,
        educations,
        skills,
        tools,
        projects,
        certifications,
      };

      const res = await fetch("/api/resume/jsonresume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to export JSONResume");
      const json = await res.json();

      // Download file
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fullName.toLowerCase().replace(/\s+/g, "_")}_resume.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Could not export JSONResume file.");
    } finally {
      setExportingJson(false);
    }
  };

  // JSONResume Import Handler
  const handleJsonImport = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (json.basics) {
            setFullName(json.basics.name || "");
            setHeadline(json.basics.label || "");
            setEmail(json.basics.email || "");
            setPhone(json.basics.phone || "");
            setPortfolio(json.basics.url || "");
            setSummary(json.basics.summary || "");
            if (json.basics.location) {
              setLocation(`${json.basics.location.city || ""}, ${json.basics.location.region || ""}`.trim().replace(/^,\s*|,\s*$/g, ""));
            }
            if (Array.isArray(json.basics.profiles)) {
              const li = json.basics.profiles.find((p: { network?: string }) => p.network?.toLowerCase().includes("linkedin"));
              const gh = json.basics.profiles.find((p: { network?: string }) => p.network?.toLowerCase().includes("github"));
              if (li) setLinkedIn(li.url || "");
              if (gh) setGithub(gh.url || "");
            }
          }
          if (Array.isArray(json.work)) {
            setExperiences(
              json.work.map((w: { position?: string; name?: string; location?: string; startDate?: string; endDate?: string; summary?: string; highlights?: string[] }, i: number) => ({
                id: `exp-imp-${i}`,
                role: w.position || "",
                company: w.name || "",
                location: w.location || "",
                startDate: w.startDate || "",
                endDate: w.endDate || "",
                current: w.endDate === "Present" || !w.endDate,
                bullets: Array.isArray(w.highlights) && w.highlights.length ? w.highlights.map((h: string) => `• ${h}`).join("\n") : w.summary || "",
              }))
            );
          }
          if (Array.isArray(json.education)) {
            setEducations(
              json.education.map((ed: { studyType?: string; institution?: string; endDate?: string; score?: string }, i: number) => ({
                id: `edu-imp-${i}`,
                degree: ed.studyType || "",
                institution: ed.institution || "",
                location: "",
                graduationYear: ed.endDate || "",
                gpaOrHonors: ed.score || "",
              }))
            );
          }
          if (Array.isArray(json.skills)) {
            const allSkills = json.skills.map((s: { keywords?: string[] }) => (s.keywords || []).join(", ")).filter(Boolean).join(", ");
            if (allSkills) setSkills(allSkills);
          }
          alert("✓ Successfully imported JSONResume data!");
        } catch {
          alert("Error parsing JSONResume file. Please check file format.");
        }
      };
      reader.readAsText(file);
    }
  };

  const copyAsText = () => {
    const contactLine = [email, phone, location, linkedIn, portfolio, github].filter(Boolean).join(" • ");
    const expText = experiences
      .map((e) => `${e.role} | ${e.company} (${e.startDate} - ${e.current ? "Present" : e.endDate})\n${e.bullets}`)
      .join("\n\n");
    const eduText = educations
      .map((e) => `${e.degree} — ${e.institution} (${e.graduationYear}) ${e.gpaOrHonors ? "\n" + e.gpaOrHonors : ""}`)
      .join("\n");
    const projText = projects
      .map((p) => `${p.title} [${p.techStack}]\n${p.liveUrl ? "Link: " + p.liveUrl + "\n" : ""}${p.description}`)
      .join("\n\n");
    const certText = certifications
      .map((c) => `${c.name} — ${c.issuer} (${c.date})`)
      .join("\n");

    const fullText = `${fullName.toUpperCase()}
${headline}
${contactLine}

PROFESSIONAL SUMMARY
${summary}

WORK EXPERIENCE
${expText}

EDUCATION
${eduText}

TECHNICAL SKILLS & TOOLS
Skills: ${skills}
Tools: ${tools}

${projects.length ? `PROJECTS\n${projText}\n\n` : ""}${certifications.length ? `CERTIFICATIONS\n${certText}` : ""}`;

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Active template metadata
  const currentTemplate = atsTemplates.find((t) => t.id === selectedTemplate) || atsTemplates[0];

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink">ATS Resume Studio &amp; Layout Engine</h2>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {currentTemplate.atsScore}% ATS Compliant
            </span>
          </div>
          <p className="text-xs text-graphite mt-0.5">
            Choose from open-source GitHub ATS layouts, customize fonts/colors, and download your clean ATS resume.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* JSON Resume Import (Hidden input) */}
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            onChange={handleJsonImport}
            className="hidden"
          />
          <GhostButton
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="text-xs bg-white gap-1"
          >
            <svg className="w-3.5 h-3.5 text-graphite" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import JSON</span>
          </GhostButton>

          <GhostButton
            type="button"
            onClick={exportJsonResume}
            disabled={exportingJson}
            className="text-xs bg-white gap-1"
          >
            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{exportingJson ? "Exporting…" : "Export JSONResume"}</span>
          </GhostButton>

          <GhostButton type="button" onClick={copyAsText} className="text-xs bg-white">
            {copied ? "✓ Copied!" : "Copy Text"}
          </GhostButton>

          <PrimaryButton type="button" onClick={handleDownloadPdf} className="text-xs gap-1.5 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Resume PDF</span>
          </PrimaryButton>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Side: Form & Layout Customizer (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {/* Section Navigation Tabs */}
          <div className="flex overflow-x-auto rounded-lg border border-line bg-white/70 p-1 text-xs gap-1">
            {[
              { id: "layout", label: "🎨 ATS Layout & Themes" },
              { id: "personal", label: "1. Personal" },
              { id: "experience", label: `2. Experience (${experiences.length})` },
              { id: "education", label: `3. Education (${educations.length})` },
              { id: "skills", label: "4. Skills & Tools" },
              { id: "projects", label: `5. Projects (${projects.length})` },
              { id: "certs", label: `6. Certs (${certifications.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-ink text-paper shadow-sm"
                    : "text-graphite hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 0: ATS Layout Selector & Themes */}
          {activeTab === "layout" && (
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-6 animate-in fade-in duration-150">
              {/* Layout Picker */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink">Choose ATS Layout Preset</h3>
                    <p className="text-xs text-graphite">Curated from top open-source GitHub resume frameworks.</p>
                  </div>
                  <span className="text-xs text-graphite font-mono">5 Layouts Available</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {atsTemplates.map((t) => {
                    const isSelected = selectedTemplate === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                          isSelected
                            ? "border-ink bg-neutral-50/90 shadow-md ring-1 ring-ink"
                            : "border-line bg-white hover:border-ink/50 hover:bg-neutral-50/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink">{t.name}</span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            {t.atsScore}% ATS
                          </span>
                        </div>
                        <p className="text-[11px] text-graphite mt-1 leading-snug line-clamp-2">
                          {t.description}
                        </p>
                        <div className="mt-2.5 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                          <span>{t.githubSource}</span>
                          <span className="capitalize">{t.structure.replace("_", " ")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color Palette */}
              <div className="border-t border-line pt-4">
                <label className="text-xs font-bold text-ink block mb-2">Accent Color Palette</label>
                <div className="flex flex-wrap gap-2">
                  {colorPalettes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        selectedColor.id === c.id
                          ? "border-ink bg-white shadow-sm ring-1 ring-ink"
                          : "border-line bg-white/70 text-graphite hover:border-ink/40"
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.hex }} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography & Density */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-line pt-4">
                <div>
                  <label className="text-xs font-bold text-ink block mb-2">Typography &amp; Font</label>
                  <select
                    value={selectedFont.id}
                    onChange={(e) => {
                      const found = fontOptions.find((f) => f.id === e.target.value);
                      if (found) setSelectedFont(found);
                    }}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink focus:border-ink"
                  >
                    {fontOptions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink block mb-2">Page Density (Fit to 1 Page)</label>
                  <div className="flex rounded-lg border border-line bg-white/60 p-1">
                    {(["compact", "normal", "spacious"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDensity(d)}
                        className={`flex-1 rounded py-1 text-xs capitalize transition-colors ${
                          density === d
                            ? "bg-ink text-paper font-semibold shadow-sm"
                            : "text-graphite hover:text-ink"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ATS Parser Checklist */}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-2">
                <p className="text-xs font-bold text-neutral-800">
                  ATS Scanner Compliance Guarantee
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> Workday Verified
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> Greenhouse Verified
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> Lever Verified
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> Taleo / iCIMS Verified
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Personal & Contact Information */}
          {activeTab === "personal" && (
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-4 animate-in fade-in duration-150">
              <h3 className="text-sm font-semibold text-ink border-b border-line pb-2">
                Personal &amp; Contact Details
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Full Name *</FieldLabel>
                  <input
                    className={inputClasses}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Rivera"
                  />
                </div>
                <div>
                  <FieldLabel>Target Role / Headline *</FieldLabel>
                  <input
                    className={inputClasses}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Senior Frontend Engineer | React"
                  />
                </div>
                <div>
                  <FieldLabel>Email Address *</FieldLabel>
                  <input
                    type="email"
                    className={inputClasses}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex.rivera@example.com"
                  />
                </div>
                <div>
                  <FieldLabel>Phone Number</FieldLabel>
                  <input
                    className={inputClasses}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                  />
                </div>
                <div>
                  <FieldLabel>Location (City, State / Country)</FieldLabel>
                  <input
                    className={inputClasses}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="San Francisco, CA"
                  />
                </div>
                <div>
                  <FieldLabel>LinkedIn URL</FieldLabel>
                  <input
                    className={inputClasses}
                    value={linkedIn}
                    onChange={(e) => setLinkedIn(e.target.value)}
                    placeholder="linkedin.com/in/alexrivera"
                  />
                </div>
                <div>
                  <FieldLabel>GitHub Profile URL</FieldLabel>
                  <input
                    className={inputClasses}
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    placeholder="github.com/alexrivera"
                  />
                </div>
                <div>
                  <FieldLabel>Portfolio / Website URL</FieldLabel>
                  <input
                    className={inputClasses}
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    placeholder="alexrivera.dev"
                  />
                </div>
              </div>

              <div className="pt-2">
                <FieldLabel>Professional Summary</FieldLabel>
                <textarea
                  className={inputClasses}
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Summarize your career highlights, core strengths, and what you bring to the role..."
                />
              </div>
            </div>
          )}

          {/* Tab 2: Work Experience */}
          {activeTab === "experience" && (
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="text-sm font-semibold text-ink">Work Experience</h3>
                <button
                  type="button"
                  onClick={addExperience}
                  className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-ink hover:bg-neutral-200 transition-colors"
                >
                  + Add Experience
                </button>
              </div>

              {experiences.length === 0 && (
                <div className="text-center py-6 text-xs text-graphite">
                  No work experience added yet. Click &ldquo;+ Add Experience&rdquo; above.
                </div>
              )}

              {experiences.map((exp, idx) => (
                <div key={exp.id} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700">Role #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeExperience(exp.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Job Title</label>
                      <input
                        className={inputClasses}
                        value={exp.role}
                        onChange={(e) => updateExperience(exp.id, "role", e.target.value)}
                        placeholder="Frontend Engineer"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Company Name</label>
                      <input
                        className={inputClasses}
                        value={exp.company}
                        onChange={(e) => updateExperience(exp.id, "company", e.target.value)}
                        placeholder="Google / Acme Corp"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Location</label>
                      <input
                        className={inputClasses}
                        value={exp.location}
                        onChange={(e) => updateExperience(exp.id, "location", e.target.value)}
                        placeholder="New York, NY (Hybrid)"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-graphite">Start Date</label>
                        <input
                          className={inputClasses}
                          value={exp.startDate}
                          onChange={(e) => updateExperience(exp.id, "startDate", e.target.value)}
                          placeholder="2021"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-graphite">End Date</label>
                        <input
                          className={inputClasses}
                          disabled={exp.current}
                          value={exp.current ? "Present" : exp.endDate}
                          onChange={(e) => updateExperience(exp.id, "endDate", e.target.value)}
                          placeholder="2023"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`current-${exp.id}`}
                      checked={exp.current}
                      onChange={(e) => updateExperience(exp.id, "current", e.target.checked)}
                      className="rounded border-gray-300 text-ink focus:ring-ink"
                    />
                    <label htmlFor={`current-${exp.id}`} className="text-xs text-graphite cursor-pointer">
                      I currently work here
                    </label>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-graphite">
                      Bullet Points &amp; Achievements (start each line with &bull;)
                    </label>
                    <textarea
                      className={inputClasses}
                      rows={3}
                      value={exp.bullets}
                      onChange={(e) => updateExperience(exp.id, "bullets", e.target.value)}
                      placeholder="• Led development of core client dashboard, speeding up render times by 40%..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Education */}
          {activeTab === "education" && (
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="text-sm font-semibold text-ink">Education</h3>
                <button
                  type="button"
                  onClick={addEducation}
                  className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-ink hover:bg-neutral-200 transition-colors"
                >
                  + Add Degree
                </button>
              </div>

              {educations.length === 0 && (
                <div className="text-center py-6 text-xs text-graphite">
                  No education entries added yet.
                </div>
              )}

              {educations.map((edu, idx) => (
                <div key={edu.id} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700">Degree #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeEducation(edu.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Degree &amp; Major</label>
                      <input
                        className={inputClasses}
                        value={edu.degree}
                        onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                        placeholder="B.S. in Computer Science"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Institution / University</label>
                      <input
                        className={inputClasses}
                        value={edu.institution}
                        onChange={(e) => updateEducation(edu.id, "institution", e.target.value)}
                        placeholder="University of California, Berkeley"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Graduation Year</label>
                      <input
                        className={inputClasses}
                        value={edu.graduationYear}
                        onChange={(e) => updateEducation(edu.id, "graduationYear", e.target.value)}
                        placeholder="2020"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Honors / GPA / Coursework</label>
                      <input
                        className={inputClasses}
                        value={edu.gpaOrHonors}
                        onChange={(e) => updateEducation(edu.id, "gpaOrHonors", e.target.value)}
                        placeholder="GPA 3.8 / Dean's List"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 4: Skills & Tools */}
          {activeTab === "skills" && (
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-4 animate-in fade-in duration-150">
              <h3 className="text-sm font-semibold text-ink border-b border-line pb-2">
                Skills &amp; Technical Tools
              </h3>

              <div>
                <FieldLabel>Core &amp; Technical Skills (comma separated)</FieldLabel>
                <textarea
                  className={inputClasses}
                  rows={3}
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, TypeScript, Next.js, Node.js, Tailwind CSS..."
                />
              </div>

              {/* Quick Add Pills */}
              <div>
                <p className="text-[11px] font-medium text-graphite mb-1.5">
                  Click to add trending in-demand skills:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {popularSkills.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSkillTag(s)}
                      className="rounded border border-line bg-neutral-50 px-2 py-0.5 text-xs text-graphite hover:border-ink hover:bg-white hover:text-ink transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Developer Tools, Frameworks &amp; Platforms</FieldLabel>
                <input
                  className={inputClasses}
                  value={tools}
                  onChange={(e) => setTools(e.target.value)}
                  placeholder="Git, Docker, AWS, Figma, Postman, Jest, Linux"
                />
              </div>
            </div>
          )}

          {/* Tab 5: Projects */}
          {activeTab === "projects" && (
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="text-sm font-semibold text-ink">Projects &amp; Portfolio</h3>
                <button
                  type="button"
                  onClick={addProject}
                  className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-ink hover:bg-neutral-200 transition-colors"
                >
                  + Add Project
                </button>
              </div>

              {projects.length === 0 && (
                <div className="text-center py-6 text-xs text-graphite">
                  No projects added yet. Click &ldquo;+ Add Project&rdquo; to showcase your work.
                </div>
              )}

              {projects.map((proj, idx) => (
                <div key={proj.id} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700">Project #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeProject(proj.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Project Title</label>
                      <input
                        className={inputClasses}
                        value={proj.title}
                        onChange={(e) => updateProject(proj.id, "title", e.target.value)}
                        placeholder="E-Commerce Storefront"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Technologies Used</label>
                      <input
                        className={inputClasses}
                        value={proj.techStack}
                        onChange={(e) => updateProject(proj.id, "techStack", e.target.value)}
                        placeholder="React, Next.js, Stripe, Tailwind"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Live Demo URL</label>
                      <input
                        className={inputClasses}
                        value={proj.liveUrl}
                        onChange={(e) => updateProject(proj.id, "liveUrl", e.target.value)}
                        placeholder="https://myproject.io"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">GitHub Repository URL</label>
                      <input
                        className={inputClasses}
                        value={proj.repoUrl}
                        onChange={(e) => updateProject(proj.id, "repoUrl", e.target.value)}
                        placeholder="github.com/username/project"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-graphite">Project Impact &amp; Features</label>
                    <textarea
                      className={inputClasses}
                      rows={2}
                      value={proj.description}
                      onChange={(e) => updateProject(proj.id, "description", e.target.value)}
                      placeholder="• Built responsive e-commerce checkout with Stripe webhook integrations..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 6: Certifications */}
          {activeTab === "certs" && (
            <div className="rounded-xl border border-line bg-white p-5 shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h3 className="text-sm font-semibold text-ink">Certifications &amp; Credentials</h3>
                <button
                  type="button"
                  onClick={addCertification}
                  className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-ink hover:bg-neutral-200 transition-colors"
                >
                  + Add Certification
                </button>
              </div>

              {certifications.length === 0 && (
                <div className="text-center py-6 text-xs text-graphite">
                  No certifications added yet.
                </div>
              )}

              {certifications.map((cert, idx) => (
                <div key={cert.id} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700">Certificate #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeCertification(cert.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Certificate Title</label>
                      <input
                        className={inputClasses}
                        value={cert.name}
                        onChange={(e) => updateCertification(cert.id, "name", e.target.value)}
                        placeholder="AWS Certified Developer"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Issuing Organization</label>
                      <input
                        className={inputClasses}
                        value={cert.issuer}
                        onChange={(e) => updateCertification(cert.id, "issuer", e.target.value)}
                        placeholder="Amazon Web Services"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Issue Year / Date</label>
                      <input
                        className={inputClasses}
                        value={cert.date}
                        onChange={(e) => updateCertification(cert.id, "date", e.target.value)}
                        placeholder="2023"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-graphite">Credential ID or URL</label>
                      <input
                        className={inputClasses}
                        value={cert.linkOrId}
                        onChange={(e) => updateCertification(cert.id, "linkOrId", e.target.value)}
                        placeholder="AWS-12345"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Rendered ATS Live Preview (5 cols) */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
                Live ATS Document Preview
              </p>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-800">
                {currentTemplate.name}
              </span>
            </div>
            <button
              type="button"
              onClick={loadPresetData}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Reset Sample
            </button>
          </div>

          {/* Rendered Sheet based on Selected ATS Layout */}
          <div
            id="printable-resume"
            className={`rounded-xl border border-neutral-300 bg-white p-6 shadow-md transition-all ${
              selectedFont.className
            } ${density === "compact" ? "space-y-2.5 text-xs" : density === "spacious" ? "space-y-5 text-sm" : "space-y-3.5 text-xs"}`}
          >
            {/* 1. Harvard Classic ATS Layout */}
            {selectedTemplate === "harvard" && (
              <div className="space-y-3.5">
                <div className="border-b-2 border-neutral-900 pb-2 text-center">
                  <h1 className="text-xl font-bold tracking-tight text-neutral-900 uppercase">
                    {fullName || "Your Full Name"}
                  </h1>
                  {headline && (
                    <p className="text-xs font-semibold text-neutral-700 mt-0.5">
                      {headline}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-neutral-600">
                    {[location, phone, email, linkedIn, github, portfolio].filter(Boolean).join(" | ")}
                  </p>
                </div>

                {summary && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-400 pb-0.5 mb-1.5">
                      Professional Summary
                    </h2>
                    <p className="text-[11.5px] leading-relaxed text-neutral-800">{summary}</p>
                  </div>
                )}

                {experiences.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-400 pb-0.5 mb-1.5">
                      Work Experience
                    </h2>
                    <div className="space-y-2.5">
                      {experiences.map((exp) => (
                        <div key={exp.id}>
                          <div className="flex items-baseline justify-between font-bold text-neutral-900">
                            <span>
                              {exp.company}{exp.location ? `, ${exp.location}` : ""}
                            </span>
                            <span className="font-normal text-neutral-600 text-[11px]">
                              {exp.startDate} – {exp.current ? "Present" : exp.endDate}
                            </span>
                          </div>
                          <p className="italic text-neutral-700 text-[11px] mb-1 font-semibold">
                            {exp.role}
                          </p>
                          {exp.bullets && (
                            <p className="text-[11px] leading-relaxed text-neutral-800 whitespace-pre-line">
                              {exp.bullets}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {educations.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-400 pb-0.5 mb-1.5">
                      Education
                    </h2>
                    <div className="space-y-1.5">
                      {educations.map((edu) => (
                        <div key={edu.id} className="flex items-baseline justify-between">
                          <div>
                            <span className="font-bold text-neutral-900">{edu.institution}</span>
                            <span className="text-neutral-700"> — {edu.degree}</span>
                            {edu.gpaOrHonors && <p className="text-[10px] text-neutral-500">{edu.gpaOrHonors}</p>}
                          </div>
                          <span className="text-[11px] text-neutral-600">{edu.graduationYear}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(skills || tools) && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-400 pb-0.5 mb-1.5">
                      Technical Skills &amp; Competencies
                    </h2>
                    {skills && (
                      <p className="text-[11px] text-neutral-800 leading-relaxed">
                        <strong>Technical Skills:</strong> {skills}
                      </p>
                    )}
                    {tools && (
                      <p className="text-[11px] text-neutral-800 leading-relaxed mt-0.5">
                        <strong>Tools &amp; Infrastructure:</strong> {tools}
                      </p>
                    )}
                  </div>
                )}

                {projects.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-400 pb-0.5 mb-1.5">
                      Key Projects
                    </h2>
                    <div className="space-y-2">
                      {projects.map((proj) => (
                        <div key={proj.id}>
                          <div className="flex items-baseline justify-between font-bold text-neutral-900">
                            <span>{proj.title} {proj.techStack && <span className="font-normal text-neutral-600">({proj.techStack})</span>}</span>
                            {proj.liveUrl && <span className="text-[10px] text-blue-600">{proj.liveUrl}</span>}
                          </div>
                          {proj.description && <p className="text-[11px] text-neutral-800 whitespace-pre-line">{proj.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {certifications.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-400 pb-0.5 mb-1.5">
                      Certifications
                    </h2>
                    <div className="space-y-1">
                      {certifications.map((c) => (
                        <div key={c.id} className="flex items-baseline justify-between text-[11px] text-neutral-800">
                          <span><strong>{c.name}</strong> — {c.issuer}</span>
                          <span>{c.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Silicon Tech / Reactive ATS Layout */}
            {selectedTemplate === "silicon" && (
              <div className="space-y-3.5">
                <div className="flex items-start justify-between border-b pb-3" style={{ borderColor: selectedColor.hex }}>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight" style={{ color: selectedColor.hex }}>
                      {fullName || "Your Full Name"}
                    </h1>
                    <p className="text-xs font-semibold text-neutral-700 mt-0.5">{headline}</p>
                  </div>
                  <div className="text-right text-[11px] text-neutral-500 space-y-0.5">
                    <p>{email}</p>
                    <p>{phone}</p>
                    <p>{location}</p>
                  </div>
                </div>

                {summary && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider pl-2 border-l-2 mb-1.5" style={{ borderColor: selectedColor.hex, color: selectedColor.hex }}>
                      Professional Summary
                    </h2>
                    <p className="text-[11.5px] leading-relaxed text-neutral-700">{summary}</p>
                  </div>
                )}

                {skills && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider pl-2 border-l-2 mb-2" style={{ borderColor: selectedColor.hex, color: selectedColor.hex }}>
                      Technical Skills
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.split(",").map((s, idx) => (
                        <span key={idx} className="rounded px-2 py-0.5 text-[10.5px] font-medium border" style={{ backgroundColor: selectedColor.bgLight, color: selectedColor.text, borderColor: selectedColor.hex + "30" }}>
                          {s.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {experiences.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider pl-2 border-l-2 mb-2" style={{ borderColor: selectedColor.hex, color: selectedColor.hex }}>
                      Work Experience
                    </h2>
                    <div className="space-y-3">
                      {experiences.map((exp) => (
                        <div key={exp.id}>
                          <div className="flex items-baseline justify-between font-bold text-neutral-900">
                            <span>{exp.role} <span className="font-normal text-neutral-500">@ {exp.company}</span></span>
                            <span className="text-[11px] text-neutral-500">{exp.startDate} – {exp.current ? "Present" : exp.endDate}</span>
                          </div>
                          {exp.bullets && <p className="text-[11px] text-neutral-700 whitespace-pre-line mt-1">{exp.bullets}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {projects.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider pl-2 border-l-2 mb-2" style={{ borderColor: selectedColor.hex, color: selectedColor.hex }}>
                      Featured Projects
                    </h2>
                    <div className="space-y-2.5">
                      {projects.map((p) => (
                        <div key={p.id}>
                          <div className="flex items-baseline justify-between font-semibold text-neutral-900">
                            <span>{p.title} {p.techStack && <span className="text-[10px] text-neutral-500 font-mono">[{p.techStack}]</span>}</span>
                            {p.liveUrl && <span className="text-[10px] text-blue-600">{p.liveUrl}</span>}
                          </div>
                          {p.description && <p className="text-[11px] text-neutral-700 whitespace-pre-line mt-0.5">{p.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {educations.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider pl-2 border-l-2 mb-1.5" style={{ borderColor: selectedColor.hex, color: selectedColor.hex }}>
                      Education &amp; Credentials
                    </h2>
                    {educations.map((ed) => (
                      <div key={ed.id} className="flex justify-between text-[11px]">
                        <span><strong>{ed.degree}</strong>, {ed.institution}</span>
                        <span>{ed.graduationYear}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Two-Column Compact ATS Layout */}
            {selectedTemplate === "two_column" && (
              <div className="grid grid-cols-12 gap-4">
                {/* Left Column (4 cols): Contact, Skills, Education */}
                <div className="col-span-4 space-y-3.5 border-r border-neutral-200 pr-3">
                  <div>
                    <h1 className="text-base font-bold leading-tight" style={{ color: selectedColor.hex }}>
                      {fullName || "Your Name"}
                    </h1>
                    <p className="text-[10px] text-neutral-600 font-medium mt-0.5">{headline}</p>
                  </div>

                  <div className="text-[10.5px] space-y-1 text-neutral-600">
                    <p className="font-bold text-neutral-900 uppercase text-[10px]">Contact Info</p>
                    <p className="truncate">{email}</p>
                    <p>{phone}</p>
                    <p>{location}</p>
                    {linkedIn && <p className="truncate text-blue-600">{linkedIn}</p>}
                    {github && <p className="truncate text-blue-600">{github}</p>}
                  </div>

                  {skills && (
                    <div className="space-y-1">
                      <p className="font-bold text-neutral-900 uppercase text-[10px]">Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {skills.split(",").map((s, i) => (
                          <span key={i} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9.5px] text-neutral-700">
                            {s.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {educations.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-bold text-neutral-900 uppercase text-[10px]">Education</p>
                      {educations.map((ed) => (
                        <div key={ed.id} className="text-[10px]">
                          <p className="font-bold text-neutral-800">{ed.degree}</p>
                          <p className="text-neutral-500">{ed.institution}</p>
                          <p className="text-neutral-400">{ed.graduationYear}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {certifications.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-bold text-neutral-900 uppercase text-[10px]">Certifications</p>
                      {certifications.map((c) => (
                        <div key={c.id} className="text-[10px]">
                          <p className="font-semibold text-neutral-800">{c.name}</p>
                          <p className="text-neutral-500">{c.issuer} ({c.date})</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column (8 cols): Summary, Experience, Projects */}
                <div className="col-span-8 space-y-3.5 pl-1">
                  {summary && (
                    <div>
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 border-b pb-0.5 mb-1" style={{ borderColor: selectedColor.hex }}>
                        Professional Summary
                      </h2>
                      <p className="text-[11px] leading-relaxed text-neutral-700">{summary}</p>
                    </div>
                  )}

                  {experiences.length > 0 && (
                    <div>
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 border-b pb-0.5 mb-2" style={{ borderColor: selectedColor.hex }}>
                        Work Experience
                      </h2>
                      <div className="space-y-2.5">
                        {experiences.map((exp) => (
                          <div key={exp.id}>
                            <div className="flex justify-between font-bold text-[11px] text-neutral-900">
                              <span>{exp.role} <span className="font-normal text-neutral-500">| {exp.company}</span></span>
                              <span className="text-[10px] text-neutral-500 font-normal">{exp.startDate} – {exp.current ? "Present" : exp.endDate}</span>
                            </div>
                            {exp.bullets && <p className="text-[10.5px] leading-relaxed text-neutral-700 whitespace-pre-line mt-0.5">{exp.bullets}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {projects.length > 0 && (
                    <div>
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-900 border-b pb-0.5 mb-1.5" style={{ borderColor: selectedColor.hex }}>
                        Featured Projects
                      </h2>
                      <div className="space-y-2">
                        {projects.map((p) => (
                          <div key={p.id}>
                            <p className="font-semibold text-[11px] text-neutral-900">
                              {p.title} {p.techStack && <span className="text-[9.5px] text-neutral-500 font-mono">({p.techStack})</span>}
                            </p>
                            {p.description && <p className="text-[10.5px] text-neutral-700 whitespace-pre-line">{p.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Executive Minimalist ATS Layout */}
            {selectedTemplate === "executive" && (
              <div className="space-y-4">
                <div className="border-b-2 pb-3" style={{ borderColor: selectedColor.hex }}>
                  <h1 className="text-2xl font-bold tracking-tight" style={{ color: selectedColor.hex }}>
                    {fullName || "Your Name"}
                  </h1>
                  <p className="text-xs font-semibold text-neutral-700 mt-0.5 uppercase tracking-wide">
                    {headline}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {[email, phone, location, linkedIn].filter(Boolean).join(" • ")}
                  </p>
                </div>

                {summary && (
                  <div className="p-3 rounded-lg border-l-4" style={{ backgroundColor: selectedColor.bgLight, borderColor: selectedColor.hex }}>
                    <p className="text-[11.5px] font-medium leading-relaxed" style={{ color: selectedColor.text }}>
                      {summary}
                    </p>
                  </div>
                )}

                {experiences.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider mb-2 border-b pb-1 text-neutral-900">
                      Leadership &amp; Professional Experience
                    </h2>
                    <div className="space-y-3">
                      {experiences.map((exp) => (
                        <div key={exp.id}>
                          <div className="flex justify-between font-bold text-neutral-900">
                            <span>{exp.role} <span className="font-semibold text-neutral-600">— {exp.company}</span></span>
                            <span className="text-[11px] text-neutral-500 font-normal">{exp.startDate} – {exp.current ? "Present" : exp.endDate}</span>
                          </div>
                          {exp.bullets && <p className="text-[11px] text-neutral-700 whitespace-pre-line mt-1">{exp.bullets}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {educations.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 border-b pb-1 text-neutral-900">
                      Education &amp; Credentials
                    </h2>
                    {educations.map((ed) => (
                      <div key={ed.id} className="flex justify-between text-[11px]">
                        <span><strong>{ed.degree}</strong>, {ed.institution}</span>
                        <span>{ed.graduationYear}</span>
                      </div>
                    ))}
                  </div>
                )}

                {skills && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 border-b pb-1 text-neutral-900">
                      Core Competencies
                    </h2>
                    <p className="text-[11px] text-neutral-700 leading-relaxed">{skills}</p>
                  </div>
                )}
              </div>
            )}

            {/* 5. LaTeX Modern CV ATS Layout (Clean, Proper Headings without Raw Syntax) */}
            {selectedTemplate === "latex" && (
              <div className="space-y-3.5 font-mono text-[11px]">
                {/* Header */}
                <div className="text-center border-b border-neutral-900 pb-3">
                  <h1 className="text-xl font-bold tracking-tight text-neutral-900 uppercase">
                    {fullName || "Candidate Name"}
                  </h1>
                  <p className="text-[11px] text-neutral-700 font-medium mt-0.5">{headline}</p>
                  <p className="text-[10px] text-neutral-500 mt-1">
                    {[email, phone, location, github, linkedIn].filter(Boolean).join("  •  ")}
                  </p>
                </div>

                {summary && (
                  <div>
                    <h2 className="font-bold text-neutral-900 uppercase text-[11px] border-b border-neutral-400 pb-0.5 mb-1 tracking-wider">
                      Executive Summary
                    </h2>
                    <p className="leading-relaxed text-neutral-700 font-sans text-xs">{summary}</p>
                  </div>
                )}

                {experiences.length > 0 && (
                  <div>
                    <h2 className="font-bold text-neutral-900 uppercase text-[11px] border-b border-neutral-400 pb-0.5 mb-1.5 tracking-wider">
                      Professional Experience
                    </h2>
                    <div className="space-y-2.5">
                      {experiences.map((exp) => (
                        <div key={exp.id}>
                          <div className="flex justify-between font-bold text-neutral-900">
                            <span>{exp.role} <span className="font-normal text-neutral-600">| {exp.company}</span></span>
                            <span className="text-[10px] font-normal text-neutral-500">{exp.startDate} – {exp.current ? "Present" : exp.endDate}</span>
                          </div>
                          {exp.bullets && <p className="font-sans text-[11px] text-neutral-700 whitespace-pre-line mt-0.5">{exp.bullets}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {skills && (
                  <div>
                    <h2 className="font-bold text-neutral-900 uppercase text-[11px] border-b border-neutral-400 pb-0.5 mb-1 tracking-wider">
                      Technical Skills &amp; Tools
                    </h2>
                    <p className="font-sans text-[11px] text-neutral-700 leading-relaxed">{skills}</p>
                    {tools && <p className="font-sans text-[10.5px] text-neutral-500 mt-0.5"><strong>Platforms:</strong> {tools}</p>}
                  </div>
                )}

                {projects.length > 0 && (
                  <div>
                    <h2 className="font-bold text-neutral-900 uppercase text-[11px] border-b border-neutral-400 pb-0.5 mb-1.5 tracking-wider">
                      Featured Projects
                    </h2>
                    <div className="space-y-2">
                      {projects.map((p) => (
                        <div key={p.id}>
                          <div className="flex justify-between font-bold text-neutral-900">
                            <span>{p.title} {p.techStack && <span className="font-normal text-neutral-500">({p.techStack})</span>}</span>
                            {p.liveUrl && <span className="text-[10px] text-blue-600 font-normal">{p.liveUrl}</span>}
                          </div>
                          {p.description && <p className="font-sans text-[10.5px] text-neutral-700 whitespace-pre-line mt-0.5">{p.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {educations.length > 0 && (
                  <div>
                    <h2 className="font-bold text-neutral-900 uppercase text-[11px] border-b border-neutral-400 pb-0.5 mb-1 tracking-wider">
                      Education
                    </h2>
                    {educations.map((ed) => (
                      <div key={ed.id} className="flex justify-between">
                        <span><strong>{ed.degree}</strong>, {ed.institution}</span>
                        <span>{ed.graduationYear}</span>
                      </div>
                    ))}
                  </div>
                )}

                {certifications.length > 0 && (
                  <div>
                    <h2 className="font-bold text-neutral-900 uppercase text-[11px] border-b border-neutral-400 pb-0.5 mb-1 tracking-wider">
                      Certifications
                    </h2>
                    {certifications.map((c) => (
                      <div key={c.id} className="flex justify-between">
                        <span><strong>{c.name}</strong> — {c.issuer}</span>
                        <span>{c.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
