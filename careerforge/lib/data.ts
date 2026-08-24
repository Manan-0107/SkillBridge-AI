import { Course, RoadmapStep, RoleId, RoleOption } from "./types";

export const roleOptions: RoleOption[] = [
  { id: "frontend", label: "Frontend Engineer", blurb: "Interfaces, interaction, performance" },
  { id: "backend", label: "Backend Engineer", blurb: "Services, data, infrastructure" },
  { id: "data", label: "Data Analyst / Scientist", blurb: "Modeling, pipelines, insight" },
  { id: "product", label: "Product Manager", blurb: "Strategy, roadmaps, execution" },
  { id: "design", label: "Product Designer", blurb: "Research, systems, craft" },
  { id: "devops", label: "DevOps / Platform Engineer", blurb: "Reliability, CI/CD, cloud" },
];

export const roadmaps: Record<RoleId, RoadmapStep[]> = {
  frontend: [
    { title: "Core web fundamentals", detail: "HTML semantics, CSS layout systems, accessibility basics.", skills: ["HTML", "CSS", "A11y"] },
    { title: "JavaScript depth", detail: "Closures, async patterns, the DOM, event loop.", skills: ["JavaScript", "DOM", "Async"] },
    { title: "A modern framework", detail: "Component architecture, state, routing in React or similar.", skills: ["React", "State mgmt", "Routing"] },
    { title: "Tooling & performance", detail: "Bundlers, testing, Core Web Vitals, profiling.", skills: ["Vite/Webpack", "Testing", "Perf"] },
    { title: "System-level thinking", detail: "Design systems, SSR/SSG, edge rendering.", skills: ["Design systems", "Next.js", "SSR"] },
    { title: "Ship & specialize", detail: "Portfolio depth, open source, pick a niche (motion, DX, mobile web).", skills: ["Portfolio", "OSS"] },
  ],
  backend: [
    { title: "Language & fundamentals", detail: "Pick one language deeply; data structures, memory model.", skills: ["Language mastery", "DSA"] },
    { title: "APIs & databases", detail: "REST/GraphQL design, SQL, indexing, transactions.", skills: ["REST", "SQL", "Indexing"] },
    { title: "System design basics", detail: "Caching, queues, load balancing, statelessness.", skills: ["Caching", "Queues", "LB"] },
    { title: "Distributed systems", detail: "Consistency models, sharding, service boundaries.", skills: ["CAP theorem", "Sharding"] },
    { title: "Observability & reliability", detail: "Logging, tracing, SLOs, incident response.", skills: ["Tracing", "SLOs"] },
    { title: "Ship & specialize", detail: "Contribute to a large codebase; pick infra, payments, or platform.", skills: ["Ownership"] },
  ],
  data: [
    { title: "Statistics & Python/R", detail: "Descriptive stats, probability, pandas/dplyr fluency.", skills: ["Statistics", "Python", "Pandas"] },
    { title: "SQL & data modeling", detail: "Joins, window functions, warehouse schemas.", skills: ["SQL", "Modeling"] },
    { title: "Visualization & storytelling", detail: "Dashboards that drive decisions, not just charts.", skills: ["Dashboards", "Storytelling"] },
    { title: "Machine learning foundations", detail: "Regression, classification, evaluation metrics.", skills: ["ML basics", "Evaluation"] },
    { title: "Experimentation", detail: "A/B testing, causal inference basics.", skills: ["A/B testing"] },
    { title: "Ship & specialize", detail: "End-to-end project; pick analytics, ML engineering, or research.", skills: ["Portfolio"] },
  ],
  product: [
    { title: "Product fundamentals", detail: "User research, problem framing, prioritization frameworks.", skills: ["Research", "Prioritization"] },
    { title: "Execution mechanics", detail: "Specs, roadmaps, working with design & engineering.", skills: ["Specs", "Roadmaps"] },
    { title: "Metrics & experimentation", detail: "North-star metrics, funnels, A/B tests.", skills: ["Metrics", "A/B"] },
    { title: "Strategy", detail: "Market sizing, positioning, competitive analysis.", skills: ["Strategy"] },
    { title: "Stakeholder leadership", detail: "Cross-functional influence without authority.", skills: ["Leadership"] },
    { title: "Ship & specialize", detail: "Own a launch end-to-end; pick growth, platform, or 0→1.", skills: ["Ownership"] },
  ],
  design: [
    { title: "Design fundamentals", detail: "Typography, color, layout, visual hierarchy.", skills: ["Typography", "Layout"] },
    { title: "UX research", detail: "Interviews, usability testing, synthesis.", skills: ["Research", "Synthesis"] },
    { title: "Interaction & systems", detail: "Component libraries, interaction states, motion.", skills: ["Design systems", "Motion"] },
    { title: "Prototyping fluency", detail: "Figma depth, rapid prototyping, handoff.", skills: ["Figma", "Prototyping"] },
    { title: "Craft & critique", detail: "Give and receive critique; build a point of view.", skills: ["Critique"] },
    { title: "Ship & specialize", detail: "Case studies with measurable outcomes; pick a domain.", skills: ["Portfolio"] },
  ],
  devops: [
    { title: "Linux & networking", detail: "Shell fluency, TCP/IP basics, DNS.", skills: ["Linux", "Networking"] },
    { title: "Containers & orchestration", detail: "Docker, Kubernetes fundamentals.", skills: ["Docker", "Kubernetes"] },
    { title: "CI/CD", detail: "Build pipelines, automated testing gates, deploy strategies.", skills: ["CI/CD"] },
    { title: "Infrastructure as code", detail: "Terraform/Pulumi, environment parity.", skills: ["IaC"] },
    { title: "Observability & reliability", detail: "Metrics, alerting, on-call practices.", skills: ["Monitoring"] },
    { title: "Ship & specialize", detail: "Own a production platform; pick cloud, security, or SRE.", skills: ["Ownership"] },
  ],
};

export const courseCatalog: Record<RoleId, Course[]> = {
  frontend: [
    { title: "The Complete JavaScript Course", provider: "Udemy", level: "Beginner", rating: 4.7, url: "https://www.udemy.com/course/the-complete-javascript-course/" },
    { title: "Meta Front-End Developer Professional Certificate", provider: "Coursera", level: "Beginner", rating: 4.7, url: "https://www.coursera.org/professional-certificates/meta-front-end-developer" },
    { title: "React - The Complete Guide", provider: "Udemy", level: "Intermediate", rating: 4.6, url: "https://www.udemy.com/course/react-the-complete-guide-incl-redux/" },
  ],
  backend: [
    { title: "The Complete Node.js Developer Course", provider: "Udemy", level: "Intermediate", rating: 4.7, url: "https://www.udemy.com/course/the-complete-nodejs-developer-course-2/" },
    { title: "Google IT Automation with Python", provider: "Coursera", level: "Beginner", rating: 4.8, url: "https://www.coursera.org/professional-certificates/google-it-automation" },
    { title: "System Design Interview", provider: "Udemy", level: "Advanced", rating: 4.6, url: "https://www.udemy.com/course/system-design-interview-prep/" },
  ],
  data: [
    { title: "IBM Data Analyst Professional Certificate", provider: "Coursera", level: "Beginner", rating: 4.6, url: "https://www.coursera.org/professional-certificates/ibm-data-analyst" },
    { title: "Python for Data Science and Machine Learning", provider: "Udemy", level: "Intermediate", rating: 4.6, url: "https://www.udemy.com/course/python-for-data-science-and-machine-learning-bootcamp/" },
    { title: "Deep Learning Specialization", provider: "Coursera", level: "Advanced", rating: 4.9, url: "https://www.coursera.org/specializations/deep-learning" },
  ],
  product: [
    { title: "Digital Product Management", provider: "Coursera", level: "Beginner", rating: 4.6, url: "https://www.coursera.org/specializations/uva-darden-digital-product-management" },
    { title: "Become a Product Manager", provider: "Udemy", level: "Beginner", rating: 4.5, url: "https://www.udemy.com/course/become-a-product-manager-learn-the-skills-earn-the-title/" },
    { title: "Product Management Fundamentals", provider: "Udemy", level: "Intermediate", rating: 4.5, url: "https://www.udemy.com/course/product-management-fundamentals-become-a-pm/" },
  ],
  design: [
    { title: "Google UX Design Professional Certificate", provider: "Coursera", level: "Beginner", rating: 4.8, url: "https://www.coursera.org/professional-certificates/google-ux-design" },
    { title: "The Complete App Design Course", provider: "Udemy", level: "Intermediate", rating: 4.6, url: "https://www.udemy.com/course/ui-ux-web-design-using-adobe-xd/" },
    { title: "Design Systems in Figma", provider: "Udemy", level: "Advanced", rating: 4.7, url: "https://www.udemy.com/course/design-systems-in-figma/" },
  ],
  devops: [
    { title: "Docker & Kubernetes: The Practical Guide", provider: "Udemy", level: "Intermediate", rating: 4.7, url: "https://www.udemy.com/course/docker-kubernetes-the-practical-guide/" },
    { title: "Google Cloud DevOps Engineer", provider: "Coursera", level: "Intermediate", rating: 4.6, url: "https://www.coursera.org/professional-certificates/sre-devops-engineer-google-cloud" },
    { title: "Terraform for the Absolute Beginner", provider: "Udemy", level: "Beginner", rating: 4.6, url: "https://www.udemy.com/course/terraform-beginner-to-advanced/" },
  ],
};

export const marketSkills: Record<RoleId, string[]> = {
  frontend: ["JavaScript", "TypeScript", "React", "CSS", "Accessibility", "Testing", "Performance", "Next.js"],
  backend: ["Node.js", "SQL", "API design", "Docker", "System design", "Caching", "Security", "Python"],
  data: ["SQL", "Python", "Statistics", "Pandas", "Data visualization", "A/B testing", "Machine learning"],
  product: ["Roadmapping", "User research", "SQL", "A/B testing", "Stakeholder management", "Prioritization"],
  design: ["Figma", "User research", "Design systems", "Prototyping", "Accessibility", "Interaction design"],
  devops: ["Kubernetes", "Docker", "Terraform", "CI/CD", "AWS", "Monitoring", "Linux"],
};
