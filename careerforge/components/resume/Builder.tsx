"use client";

import { useState } from "react";
import { FieldLabel, GhostButton, PrimaryButton, inputClasses } from "@/components/ui/Primitives";

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

export function Builder() {
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
  const [template, setTemplate] = useState<"modern" | "clean" | "executive">("modern");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"personal" | "experience" | "education" | "skills" | "projects" | "certs">("personal");

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

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Resume Generator</h2>
          <p className="text-xs text-graphite">
            Fill in your details below to generate a tailored, ATS-compliant professional resume.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <GhostButton type="button" onClick={loadPresetData} className="text-xs bg-white">
            Load Sample Profile
          </GhostButton>
          <GhostButton type="button" onClick={copyAsText} className="text-xs bg-white">
            {copied ? "✓ Copied!" : "Copy Plain Text"}
          </GhostButton>
          <PrimaryButton type="button" onClick={() => window.print()} className="text-xs gap-1.5 shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print / Save PDF</span>
          </PrimaryButton>
        </div>
      </div>

      {/* Main Grid: Form Inputs & Real-time Live Preview */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Side: Form Sections (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {/* Section Navigation Tabs */}
          <div className="flex overflow-x-auto rounded-lg border border-line bg-white/70 p-1 text-xs gap-1">
            {[
              { id: "personal", label: "1. Personal" },
              { id: "experience", label: `2. Experience (${experiences.length})` },
              { id: "education", label: `3. Education (${educations.length})` },
              { id: "skills", label: "4. Skills & Tools" },
              { id: "projects", label: `5. Projects (${projects.length})` },
              { id: "certs", label: `6. Certifications (${certifications.length})` },
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

        {/* Right Side: Live Resume Document Preview (5 cols) */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
              Live ATS Resume Preview
            </p>
            <div className="flex gap-1 text-xs">
              {(["modern", "clean", "executive"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemplate(t)}
                  className={`rounded px-2 py-0.5 capitalize transition-colors ${
                    template === t
                      ? "bg-ink text-paper"
                      : "text-graphite hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Rendered Document Sheet */}
          <div
            id="printable-resume"
            className={`rounded-xl border border-neutral-300 bg-white p-6 shadow-md transition-all ${
              template === "executive" ? "font-serif text-neutral-900" : "font-sans text-neutral-800"
            }`}
          >
            {/* Header / Contact */}
            <div className="border-b border-neutral-200 pb-3 text-center">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                {fullName || "Your Full Name"}
              </h1>
              {headline && (
                <p className="text-xs font-medium text-neutral-600 mt-0.5">
                  {headline}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
                {email && <span>{email}</span>}
                {phone && <span>• {phone}</span>}
                {location && <span>• {location}</span>}
                {linkedIn && <span>• {linkedIn}</span>}
                {github && <span>• {github}</span>}
                {portfolio && <span>• {portfolio}</span>}
              </div>
            </div>

            {/* Summary */}
            {summary && (
              <div className="mt-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-1.5">
                  Professional Summary
                </h2>
                <p className="text-[12px] leading-relaxed text-neutral-700">
                  {summary}
                </p>
              </div>
            )}

            {/* Experience */}
            {experiences.length > 0 && (
              <div className="mt-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                  Work Experience
                </h2>
                <div className="space-y-3">
                  {experiences.map((exp) => (
                    <div key={exp.id}>
                      <div className="flex items-baseline justify-between text-xs font-semibold text-neutral-900">
                        <span>
                          {exp.role || "Job Title"}{" "}
                          <span className="font-normal text-neutral-600">
                            | {exp.company || "Company"}
                          </span>
                        </span>
                        <span className="text-[11px] font-normal text-neutral-500">
                          {exp.startDate || "Date"} – {exp.current ? "Present" : exp.endDate || "Date"}
                        </span>
                      </div>
                      {exp.location && (
                        <p className="text-[10px] text-neutral-400 italic mb-1">{exp.location}</p>
                      )}
                      {exp.bullets && (
                        <p className="text-[11px] leading-relaxed text-neutral-700 whitespace-pre-line mt-1">
                          {exp.bullets}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {educations.length > 0 && (
              <div className="mt-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                  Education
                </h2>
                <div className="space-y-2">
                  {educations.map((edu) => (
                    <div key={edu.id} className="text-xs">
                      <div className="flex items-baseline justify-between font-semibold text-neutral-900">
                        <span>{edu.degree || "Degree"}</span>
                        <span className="text-[11px] font-normal text-neutral-500">
                          {edu.graduationYear}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-600">
                        {edu.institution}{edu.location ? ` — ${edu.location}` : ""}
                      </p>
                      {edu.gpaOrHonors && (
                        <p className="text-[10px] text-neutral-500 italic mt-0.5">
                          {edu.gpaOrHonors}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skills & Tools */}
            {(skills || tools) && (
              <div className="mt-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-1.5">
                  Technical Skills &amp; Tools
                </h2>
                {skills && (
                  <p className="text-[11px] leading-relaxed text-neutral-700">
                    <strong>Core Skills:</strong> {skills}
                  </p>
                )}
                {tools && (
                  <p className="text-[11px] leading-relaxed text-neutral-700 mt-1">
                    <strong>Tools &amp; Platforms:</strong> {tools}
                  </p>
                )}
              </div>
            )}

            {/* Projects */}
            {projects.length > 0 && (
              <div className="mt-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-2">
                  Featured Projects
                </h2>
                <div className="space-y-2.5">
                  {projects.map((proj) => (
                    <div key={proj.id} className="text-xs">
                      <div className="flex items-baseline justify-between font-semibold text-neutral-900">
                        <span>
                          {proj.title || "Project Title"}{" "}
                          {proj.techStack && (
                            <span className="text-[10px] font-normal text-neutral-500">
                              ({proj.techStack})
                            </span>
                          )}
                        </span>
                        {proj.liveUrl && (
                          <span className="text-[10px] text-blue-600 underline">
                            {proj.liveUrl}
                          </span>
                        )}
                      </div>
                      {proj.description && (
                        <p className="text-[11px] leading-relaxed text-neutral-700 whitespace-pre-line mt-0.5">
                          {proj.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {certifications.length > 0 && (
              <div className="mt-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-200 pb-1 mb-1.5">
                  Certifications
                </h2>
                <div className="space-y-1.5">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="flex items-baseline justify-between text-xs text-neutral-800">
                      <span>
                        <strong>{cert.name || "Certification"}</strong> — {cert.issuer}
                      </span>
                      <span className="text-[11px] text-neutral-500">{cert.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
