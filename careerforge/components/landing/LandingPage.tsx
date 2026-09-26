"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  Bot,
  Map,
  Code2,
  FileText,
  Briefcase,
  Volume2,
  TrendingUp,
  Target,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Layers,
  Eye,
  Sliders,
} from "lucide-react";
import { UbixThinkingOrb } from "@/components/ubix/UbixThinkingOrb";
import { UbixMetallicSurface } from "@/components/ubix/UbixMetallicSurface";
import { UbixGlowBorder } from "@/components/ubix/UbixGlowBorder";

// Dynamically import Three.js Hero Scene with no SSR
const UbixHeroScene = dynamic(
  () => import("@/components/ubix/UbixHeroScene").then((m) => m.UbixHeroScene),
  { ssr: false }
);

interface LandingPageProps {
  onEnter: () => void;
  onGuestLogin: () => void;
}

export function LandingPage({ onEnter, onGuestLogin }: LandingPageProps) {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);

  const capabilities = [
    {
      icon: <Bot className="w-5 h-5 text-accent" />,
      title: "ubix Assistant",
      desc: "Context-aware conversational intelligence with multimodal reasoning and accessible voice control.",
    },
    {
      icon: <Target className="w-5 h-5 text-accent" />,
      title: "Skill Gap Analysis",
      desc: "Mathematical comparison of your profile against verified industry requirements and benchmarks.",
    },
    {
      icon: <Map className="w-5 h-5 text-accent" />,
      title: "Personalized Roadmap",
      desc: "Tier-by-tier learning graphs with milestone verification and curated reference materials.",
    },
    {
      icon: <Code2 className="w-5 h-5 text-accent" />,
      title: "Adaptive Practice",
      desc: "Real-world engineering, algorithmic, and architectural drills with instant diagnostic feedback.",
    },
    {
      icon: <FileText className="w-5 h-5 text-accent" />,
      title: "Resume Engineering",
      desc: "Automated ATS scoring, structured keyword alignment, and conversational section crafting.",
    },
    {
      icon: <Briefcase className="w-5 h-5 text-accent" />,
      title: "Verified Opportunities",
      desc: "Targeted job discovery filtered by genuine skills, remote availability, and transparent salaries.",
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-accent" />,
      title: "Quantified Progress",
      desc: "Real-time readiness benchmarks tracking your trajectory toward senior and staff roles.",
    },
    {
      icon: <Volume2 className="w-5 h-5 text-accent" />,
      title: "Universal Accessibility",
      desc: "Engineered from inception for blind, low-vision, deaf, and motor-impaired technologists.",
    },
  ];

  const workflowSteps = [
    { title: "Career Goal", detail: "Define your aspiration and desired seniority tier" },
    { title: "AI Profile", detail: "Synthesize background, projects, and authentic strengths" },
    { title: "Skill Gap", detail: "Compute exact missing proficiencies mathematically" },
    { title: "Roadmap", detail: "Generate sequenced milestone curriculum and materials" },
    { title: "Learning", detail: "Master fundamentals through curated verified resources" },
    { title: "Practice", detail: "Complete targeted coding and behavioral interview drills" },
    { title: "Progress", detail: "Benchmark readiness against verified candidate criteria" },
    { title: "Resume", detail: "Engineer high-impact, ATS-optimized portfolio documents" },
    { title: "Jobs", detail: "Match with vetted employers aligned with your profile" },
    { title: "Upskilling", detail: "Sustain lifelong mastery as technologies evolve" },
  ];

  return (
    <div className="w-full text-ink selection:bg-surface selection:text-ink">
      {/* ─── Public Minimal Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-ink/8 bg-bg/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-xl font-bold tracking-tight text-ink select-none">
              ubix
            </span>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-ink/10 bg-surface/40 text-[10px] text-ink/60 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              v3.2 workspace
            </div>
          </div>

          <nav className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onGuestLogin}
              className="px-3.5 py-1.5 rounded-xl border border-ink/12 bg-surface/60 text-xs font-semibold text-ink/80 hover:text-ink hover:border-ink/25 hover:bg-surface transition-all cursor-pointer font-sans"
            >
              Explore as Guest
            </button>
            <button
              type="button"
              onClick={onEnter}
              className="px-4 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-soft shadow-sm transition-all cursor-pointer font-sans"
            >
              Launch Workspace
            </button>
          </nav>
        </div>
      </header>

      {/* ─── Hero Section with Three.js Visual Centerpiece ──────────────────── */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left: Product Manifesto & Action */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink/12 bg-surface/40 text-xs text-ink/70">
                <UbixThinkingOrb state="idle" size="sm" />
                <span className="font-medium">Quiet, intelligent career infrastructure</span>
              </div>

              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink leading-[1.08]">
                Autonomous Career Intelligence &amp; Accessibility.
              </h1>

              <p className="text-base sm:text-lg text-ink/60 max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans">
                Resume engineering, tier-by-tier skill roadmaps, adaptive interview practice, and verified opportunities in one focused dark workspace.
              </p>

              {/* Hero Call to Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={onEnter}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-accent text-white text-sm font-semibold hover:bg-accent-soft shadow-md shadow-accent/20 transition-all cursor-pointer font-sans"
                >
                  <span>Launch Workspace</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={onGuestLogin}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-ink/15 bg-surface/60 text-sm font-semibold text-ink hover:bg-surface hover:border-ink/30 transition-all cursor-pointer font-sans"
                >
                  <span>Explore as Guest</span>
                </button>
              </div>

              {/* Minimal Trust & Accessibility Indicators */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs text-ink/50">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-accent" />
                  <span>Zero tracking ads</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-accent" />
                  <span>Full voice &amp; screen-reader parity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-accent" />
                  <span>Instant guest sandbox</span>
                </div>
              </div>
            </div>

            {/* Right: Three.js Centerpiece Scene */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <UbixGlowBorder active className="w-full">
                <UbixMetallicSurface className="p-3 sm:p-4 overflow-hidden">
                  <div className="relative w-full aspect-square max-w-[440px] mx-auto rounded-xl overflow-hidden flex items-center justify-center">
                    <UbixHeroScene />
                  </div>
                  <div className="mt-3 px-3 py-2 rounded-xl border border-ink/8 bg-bg/50 flex items-center justify-between text-[11px] text-ink/60 font-sans">
                    <span className="font-medium">Fluid Cognitive Geometry</span>
                    <span className="text-accent">Interactive Studio Mesh</span>
                  </div>
                </UbixMetallicSurface>
              </UbixGlowBorder>
            </div>

          </div>
        </div>
      </section>

      {/* ─── Product Experience: Core Capabilities ───────────────────────── */}
      <section className="py-20 border-t border-ink/8 bg-surface/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase tracking-widest text-accent font-semibold">
              Product Capabilities
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-ink">
              An Integrated Ecosystem for Technical Mastery
            </h2>
            <p className="text-sm text-ink/60 leading-relaxed font-sans">
              Every tool shares one context model. What you practice updates your readiness; what you build updates your resume.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {capabilities.map((c, idx) => (
              <UbixMetallicSurface
                key={idx}
                className="p-5 flex flex-col justify-between space-y-4 hover:border-ink/25"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl border border-ink/10 bg-bg flex items-center justify-center shadow-sm">
                    {c.icon}
                  </div>
                  <h3 className="font-display text-base font-semibold text-ink">
                    {c.title}
                  </h3>
                  <p className="text-xs text-ink/60 leading-relaxed font-sans">
                    {c.desc}
                  </p>
                </div>
              </UbixMetallicSurface>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Universal Accessibility Section ──────────────────────────────── */}
      <section className="py-20 border-t border-ink/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs uppercase tracking-widest text-accent font-semibold">
                Accessibility-First Architecture
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-ink">
                Engineered for Complete Independence
              </h2>
              <p className="text-sm text-ink/70 leading-relaxed font-sans">
                Most career platforms treat accessibility as an afterthought. UBIX is architected from day one so that visually impaired, blind, deaf, and motor-impaired candidates operate with full autonomy.
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-xl border border-ink/10 bg-surface/40 flex items-start gap-3">
                  <Volume2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Conversational Voice Navigation</h4>
                    <p className="text-[11px] text-ink/60">Hands-free route dispatch, audiobook roadmap playback, and real-time dictation.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-ink/10 bg-surface/40 flex items-start gap-3">
                  <Eye className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-ink">Specialized Accessibility Profiles</h4>
                    <p className="text-[11px] text-ink/60">Presets for Blind / Low Vision, Deaf / Hard of Hearing, Motor Ease, and Cognitive Calm.</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-ink/10 bg-surface/40 flex items-start gap-3">
                  <Sliders className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-ink">WCAG AA Contrast &amp; Semantic Trees</h4>
                    <p className="text-[11px] text-ink/60">Strict contrast compliance, live ARIA announcements, and zero keyboard traps.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <UbixMetallicSurface className="p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-ink/8">
                  <span className="font-display text-sm font-semibold text-ink">Active Accessibility Profile</span>
                  <span className="text-[11px] text-accent font-medium">Verified Compliance</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl border border-ink/10 bg-bg space-y-1">
                    <span className="text-[10px] text-ink/40 uppercase">Audiobook Mode</span>
                    <p className="font-semibold text-ink">Synthetic Voice Output</p>
                  </div>
                  <div className="p-3 rounded-xl border border-ink/10 bg-bg space-y-1">
                    <span className="text-[10px] text-ink/40 uppercase">Screen Reader</span>
                    <p className="font-semibold text-ink">Full ARIA 1.2 Parity</p>
                  </div>
                  <div className="p-3 rounded-xl border border-ink/10 bg-bg space-y-1">
                    <span className="text-[10px] text-ink/40 uppercase">Color Contrast</span>
                    <p className="font-semibold text-ink">4.5:1+ WCAG AA</p>
                  </div>
                  <div className="p-3 rounded-xl border border-ink/10 bg-bg space-y-1">
                    <span className="text-[10px] text-ink/40 uppercase">Reduced Motion</span>
                    <p className="font-semibold text-ink">System Compliant</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-accent/25 bg-accent/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UbixThinkingOrb state="listening" size="sm" />
                    <span className="text-xs font-medium text-accent">Voice Interface Ready</span>
                  </div>
                  <span className="text-[10px] text-accent/80 font-mono">Alt + V</span>
                </div>
              </UbixMetallicSurface>
            </div>

          </div>
        </div>
      </section>

      {/* ─── Continuous Workflow Pipeline ─────────────────────────────────── */}
      <section className="py-20 border-t border-ink/8 bg-surface/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs uppercase tracking-widest text-accent font-semibold">
              The ubix Pipeline
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-ink">
              From Career Aspiration to Continuous Upskilling
            </h2>
            <p className="text-sm text-ink/60 leading-relaxed font-sans">
              Follow a proven technical pipeline designed to eliminate guesswork and compound your professional growth.
            </p>
          </div>

          {/* Interactive Steps Reel */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {workflowSteps.map((step, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveWorkflowStep(idx)}
                className={`p-3 rounded-xl text-left transition-all border cursor-pointer font-sans ${
                  activeWorkflowStep === idx
                    ? "border-accent/40 bg-surface shadow-sm"
                    : "border-ink/8 bg-bg/60 hover:bg-surface/60 text-ink/70"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-accent">0{idx + 1}</span>
                  {activeWorkflowStep === idx && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </div>
                <h4 className="text-xs font-semibold text-ink">{step.title}</h4>
              </button>
            ))}
          </div>

          {/* Step Detail Spotlight */}
          <UbixMetallicSurface className="p-6 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 max-w-xl">
              <span className="text-[11px] text-accent font-mono">Stage 0{activeWorkflowStep + 1} Focus</span>
              <h3 className="font-display text-xl font-bold text-ink">
                {workflowSteps[activeWorkflowStep].title}
              </h3>
              <p className="text-xs text-ink/70 leading-relaxed font-sans">
                {workflowSteps[activeWorkflowStep].detail}. Every action taken in this phase connects automatically into your continuous portfolio and practice telemetry.
              </p>
            </div>

            <button
              type="button"
              onClick={onEnter}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-soft shrink-0 transition-all cursor-pointer font-sans"
            >
              Start at Stage 0{activeWorkflowStep + 1}
            </button>
          </UbixMetallicSurface>
        </div>
      </section>

      {/* ─── Final Minimal Call to Action ─────────────────────────────────── */}
      <section className="py-24 border-t border-ink/8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <UbixThinkingOrb state="thinking" size="md" className="mx-auto" />
          
          <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-ink">
            Ready to set up your workspace?
          </h2>

          <p className="text-sm sm:text-base text-ink/60 max-w-lg mx-auto leading-relaxed font-sans">
            No credit card required. Explore as a candidate demo guest or set up your persistent workspace today.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={onEnter}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-accent text-white text-sm font-semibold hover:bg-accent-soft shadow-lg shadow-accent/20 transition-all cursor-pointer font-sans"
            >
              Launch Workspace
            </button>
            <button
              type="button"
              onClick={onGuestLogin}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl border border-ink/15 bg-surface/60 text-sm font-semibold text-ink hover:bg-surface hover:border-ink/30 transition-all cursor-pointer font-sans"
            >
              Explore as Guest
            </button>
          </div>
        </div>
      </section>

      {/* ─── Public Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-ink/8 py-8 bg-bg/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink/50">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-ink">ubix</span>
            <span>— quiet, intelligent career infrastructure</span>
          </div>

          <div className="flex items-center gap-6">
            <span>WCAG 2.1 AA Compliant</span>
            <span>Dark mode environment</span>
            <span>Privacy-first architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
