"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Volume2,
  Eye,
  Sliders,
  ArrowRight,
  Keyboard,
  Mic,
  MessageSquare,
  Target,
  BookOpen,
  Code2,
  FileText,
  Briefcase,
  Map,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { CareerNodeId } from "@/components/ubix/UbixCareerGraph";

// ── Dynamic 3D Career Graph Scene (SSR: false) ───────────────────────────────
const UbixCareerGraph = dynamic(
  () => import("@/components/ubix/UbixCareerGraph").then((m) => m.UbixCareerGraph),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[620px] sm:h-[720px] lg:h-[820px] rounded-3xl border border-white/[0.07] bg-[#080A0D] flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full border border-white/10 bg-[#121518] animate-pulse flex items-center justify-center">
            <span className="font-display font-bold text-white text-xs">ubix</span>
          </div>
          <span className="text-xs font-mono text-[#8B9096]">Loading Career Universe...</span>
        </div>
      </div>
    ),
  }
);

// ── Types ────────────────────────────────────────────────────────────────────
interface LandingPageProps {
  onEnter: () => void;
  onGuestLogin: () => void;
}

type AssistantState = {
  id: string;
  label: string;
  sublabel: string;
  orbColor: string;
  orbPulse: boolean;
};

// ── Data ─────────────────────────────────────────────────────────────────────
const ASSISTANT_STATES: AssistantState[] = [
  { id: "idle",       label: "Idle",             sublabel: "Ready when you are.",             orbColor: "#8B9096",  orbPulse: false },
  { id: "listening",  label: "Listening\u2026",   sublabel: "Voice input active. Speak now.",  orbColor: "var(--accent)",  orbPulse: true  },
  { id: "thinking",   label: "Thinking\u2026",    sublabel: "Analysing your question.",         orbColor: "#A5ABB2",        orbPulse: true  },
  { id: "processing", label: "Processing\u2026",  sublabel: "Finding relevant information.",    orbColor: "var(--accent)",  orbPulse: true  },
  { id: "answer",     label: "Answer ready",     sublabel: "Response generated.",              orbColor: "#34D399",  orbPulse: false },
  { id: "action",     label: "Action completed", sublabel: "Task executed successfully.",      orbColor: "#34D399",  orbPulse: false },
];

const SCATTER_VS_SYSTEM = [
  {
    phase: "1. Resume Profile",
    scattered: "Static PDF updated once a year. ATS keywords guessed blindly.",
    system: "Living profile intelligence continuously updated by verified work.",
  },
  {
    phase: "2. Skill Gaps",
    scattered: "Gaps stay invisible until you receive rejection emails.",
    system: "Exact missing proficiencies computed against live employer benchmarks.",
  },
  {
    phase: "3. Adaptive Learning",
    scattered: "Unfocused 60-hour video playlists with 90% redundant content.",
    system: "Laser-focused micro-curriculums addressing only your identified gaps.",
  },
  {
    phase: "4. Practical Validation",
    scattered: "Isolated coding drills disconnected from real interview scenarios.",
    system: "Targeted engineering & behavioral drills validating job readiness.",
  },
  {
    phase: "5. Job Opportunities",
    scattered: "Mass-applying to hundreds of unvetted listings with low response rates.",
    system: "Direct matching to verified roles where your demonstrated skills qualify you.",
  },
];

// ── IntersectionObserver reveal hook ────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function StateOrb({ color, pulse }: { color: string; pulse: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        animation: pulse ? "ubix-orb-pulse 1.6s ease-in-out infinite" : "none",
      }}
    />
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function LandingPage({ onEnter, onGuestLogin }: LandingPageProps) {
  const [activeState, setActiveState] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setActiveState((s) => (s + 1) % ASSISTANT_STATES.length),
      2400
    );
    return () => clearInterval(id);
  }, []);

  const state = ASSISTANT_STATES[activeState];

  const handleNodeAction = (nodeId: CareerNodeId | "core") => {
    onEnter();
  };

  return (
    <div className="w-full text-ink selection:bg-surface selection:text-ink min-h-screen">

      {/* ── HEADER / NAV ────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#080A0D]/90 backdrop-blur-md"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="#"
              aria-label="ubix home"
              className="font-display text-xl font-bold tracking-tight text-white select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] rounded-sm"
            >
              ubix
            </a>
          </div>

          <nav
            aria-label="Landing navigation"
            className="hidden md:flex items-center gap-7 text-xs font-medium font-mono text-[#8B9096]"
          >
            {[
              { href: "#career-graph",  label: "01 // CAREER GRAPH" },
              { href: "#system-arch",   label: "02 // ARCHITECTURE" },
              { href: "#intelligence",  label: "03 // INTELLIGENCE" },
              { href: "#accessibility", label: "04 // ACCESSIBILITY"},
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--accent] rounded-sm tracking-wider uppercase"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              id="nav-signin-btn"
              type="button"
              onClick={onEnter}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#C7CCD1] hover:text-white transition-colors cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
              Sign In
            </button>
            <button
              id="nav-getstarted-btn"
              type="button"
              onClick={onEnter}
              className="px-4 py-1.5 rounded-lg bg-[--accent] text-[#080A0D] text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO: THE LIVING CAREER GRAPH (THE CORE UBIX EXPERIENCE) ────────── */}
      <section
        id="career-graph"
        aria-labelledby="hero-title"
        className="relative pt-8 pb-16 sm:pt-12 sm:pb-24 overflow-hidden"
      >
        {/* 1. Heading block */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-[#121518] text-xs text-[#8B9096] font-medium font-sans">
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-[--accent]"
                style={{ animation: "ubix-orb-pulse 2s ease-in-out infinite" }}
              />
              Quiet, intelligent career infrastructure
            </div>

            <h1
              id="hero-title"
              className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]"
            >
              YOUR CAREER.
              <br />
              <span className="text-white/90">CONNECTED.</span>
            </h1>

            <div className="pt-1">
              <p className="text-xs sm:text-sm font-mono tracking-wide text-[--accent]">
                Resume &rarr; Skills &rarr; Learning &rarr; Practice &rarr; Opportunities
              </p>
              <p className="text-xs sm:text-sm text-[#8B9096] font-sans mt-2 max-w-xl mx-auto">
                ubix is not a collection of disconnected features. It is a living, continuous career system.
                Interact with the graph or select any node to enter.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Full-bleed 3D Career Graph Interactive System */}
        <div className="relative w-full">
          <UbixCareerGraph
            onCtaClick={handleNodeAction}
          />
        </div>

        {/* 3. CTA buttons & keyboard-hint */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <button
              id="hero-getstarted-btn"
              type="button"
              onClick={onEnter}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[--accent] text-[#080A0D] text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
              <span>Enter Career System</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button
              id="hero-guest-btn"
              type="button"
              onClick={onGuestLogin}
              className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-[#C7CCD1] hover:border-white/20 hover:text-white transition-all cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
              Try as Guest
            </button>
          </div>

          <p className="text-center text-[11px] font-mono text-[#62676D] mt-4">
            Navigation: Press <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-[#121518] text-[#A5ABB2]">Tab</kbd> to cycle nodes, <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-[#121518] text-[#A5ABB2]">1-7</kbd> for direct focus, <kbd className="px-1.5 py-0.5 rounded border border-white/10 bg-[#121518] text-[#A5ABB2]">Esc</kbd> to reset view.
          </p>
        </div>
      </section>

      {/* ── SECTION 2: THE CONNECTED ARCHITECTURE ───────────────────────────── */}
      <section
        id="system-arch"
        aria-labelledby="arch-heading"
        className="py-24 border-t border-white/[0.06] bg-[#0A0D11]/60"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-widest text-[--accent] font-mono font-semibold">
              The Architecture
            </span>
            <h2
              id="arch-heading"
              className="mt-3 font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight"
            >
              Why a connected system changes everything
            </h2>
            <p className="mt-4 text-[#8B9096] text-sm sm:text-base leading-relaxed font-sans">
              Most career tools exist in isolated silos. When tools don't communicate, candidates waste months on the wrong courses, submit misaligned resumes, and discover skill deficiencies only after rejection.
            </p>
          </Reveal>

          {/* Comparison Matrix: Scattered vs Connected */}
          <div className="space-y-3">
            {SCATTER_VS_SYSTEM.map((row, idx) => (
              <Reveal key={row.phase} delay={idx * 60}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 sm:p-5 rounded-2xl border border-white/[0.06] bg-[#0D0F12] items-center">
                  <div className="md:col-span-3">
                    <span className="text-xs font-mono text-[--accent] font-semibold">
                      {row.phase}
                    </span>
                  </div>

                  <div className="md:col-span-4 p-3 rounded-xl bg-[#14181D]/60 border border-white/[0.04]">
                    <span className="text-[10px] font-mono text-[#8B9096] uppercase block mb-1">
                      Scattered Tools
                    </span>
                    <p className="text-xs text-[#A5ABB2] font-sans leading-relaxed">
                      {row.scattered}
                    </p>
                  </div>

                  <div className="hidden md:flex md:col-span-1 justify-center text-[#62676D]">
                    <ArrowRight size={16} />
                  </div>

                  <div className="md:col-span-4 p-3 rounded-xl bg-[#080A0D] border border-[--accent]/20">
                    <span className="text-[10px] font-mono text-[--accent] uppercase block mb-1">
                      ubix Connected System
                    </span>
                    <p className="text-xs text-white font-sans leading-relaxed">
                      {row.system}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Pipeline Summary Banner */}
          <Reveal delay={200} className="mt-14 p-6 sm:p-8 rounded-3xl border border-white/[0.08] bg-[#0D0F12] text-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8B9096]">
              Continuous feedback loop
            </span>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white mt-1 mb-2">
              Every action informs the next step
            </h3>
            <p className="text-xs sm:text-sm text-[#8B9096] max-w-2xl mx-auto font-sans leading-relaxed mb-6">
              What you learn updates your roadmap. What you practice updates your readiness score. What you build updates your ATS resume. Opportunities unlock automatically.
            </p>
            <button
              type="button"
              onClick={onEnter}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-bold font-sans transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
            >
              <span>Explore The System</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── SECTION 3: THE INTELLIGENCE LAYER ───────────────────────────────── */}
      <section
        id="intelligence"
        aria-labelledby="intelligence-heading"
        className="py-24 border-t border-white/[0.06]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-5 space-y-5">
              <Reveal>
                <span className="text-xs uppercase tracking-widest text-[--accent] font-mono font-semibold">
                  Intelligence Layer
                </span>
              </Reveal>
              <Reveal delay={80}>
                <h2
                  id="intelligence-heading"
                  className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight"
                >
                  The Assistant connects every dot
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="text-[#A5ABB2] text-sm leading-relaxed font-sans">
                  The ubix Assistant is not an isolated chatbot widget. It is the intelligence layer spanning the entire career graph — synthesizing your profile, computing missing skills, generating roadmaps, evaluating code, and tailoring resume bullet points in real-time.
                </p>
              </Reveal>
              <Reveal delay={200}>
                <p className="text-[#8B9096] text-xs sm:text-sm leading-relaxed font-sans">
                  Every state communicates clearly. When processing complex career inferences, visible text and live feedback keep you in complete control.
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delay={100}>
                <div
                  className="rounded-2xl border border-white/[0.06] bg-[#0D0F12] overflow-hidden"
                  aria-label="Assistant state demonstration"
                >
                  {/* Active state display */}
                  <div
                    className="p-6 border-b border-white/[0.06] flex items-start gap-4"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <StateOrb color={state.orbColor} pulse={state.orbPulse} />
                    <div>
                      <p className="text-sm font-semibold text-white font-display">{state.label}</p>
                      <p className="text-xs text-[#8B9096] mt-0.5 font-sans">{state.sublabel}</p>
                    </div>
                  </div>

                  {/* All 6 state selector buttons */}
                  <div
                    role="group"
                    aria-label="Select assistant state"
                    className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-white/[0.04]"
                  >
                    {ASSISTANT_STATES.map((s, idx) => (
                      <button
                        key={s.id}
                        id={`assistant-state-${s.id}`}
                        type="button"
                        aria-pressed={activeState === idx}
                        aria-label={`State: ${s.label}`}
                        onClick={() => setActiveState(idx)}
                        className={`p-3 text-center transition-colors cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-inset ${
                          activeState === idx
                            ? "bg-[#121518] text-white"
                            : "bg-[#0D0F12] text-[#62676D] hover:bg-[#121518] hover:text-[#8B9096]"
                        }`}
                      >
                        <StateOrb color={activeState === idx ? s.orbColor : "#292D32"} pulse={false} />
                        <p className="text-[10px] mt-1.5 font-medium leading-tight">{s.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 4: ACCESSIBILITY FIRST ──────────────────────────────────── */}
      <section
        id="accessibility"
        aria-labelledby="a11y-heading"
        className="py-24 border-t border-white/[0.06] bg-[#0A0D11]/60"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

            <div className="lg:col-span-5 space-y-5">
              <Reveal>
                <span className="text-xs uppercase tracking-widest text-[--accent] font-mono font-semibold">
                  Accessibility-First
                </span>
              </Reveal>
              <Reveal delay={80}>
                <h2
                  id="a11y-heading"
                  className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight"
                >
                  Engineered for complete independence
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="text-[#A5ABB2] text-sm leading-relaxed font-sans">
                  Most platforms treat accessibility as a secondary patch. ubix is architected from day one so that blind, low-vision, deaf, and motor-impaired technologists operate with total autonomy across every tool.
                </p>
              </Reveal>
              <Reveal delay={200}>
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[--accent]/30 bg-[#080A0D] text-xs font-mono text-[--accent]">
                    <ShieldCheck size={14} />
                    <span>WCAG 2.1 AA COMPLIANT ARCHITECTURE</span>
                  </div>
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {[
                { icon: <Volume2 size={18} />,      title: "Voice interaction & dictation", desc: "Hands-free workspace navigation, route dispatch, audiobook roadmap playback, and real-time voice dictation." },
                { icon: <MessageSquare size={18} />, title: "Captions & transcripts",        desc: "Every audio output and assistant response is available as simultaneous on-screen text for deaf and hard-of-hearing users." },
                { icon: <Eye size={18} />,           title: "Screen-reader support",         desc: "Full ARIA 1.2 semantic tree, live regions for state updates, and descriptive accessible labels on all controls." },
                { icon: <Mic size={18} />,           title: "Spoken confirmation",           desc: "Critical actions — submit, navigate, delete — are confirmed aloud for users with visual impairments." },
                { icon: <Sliders size={18} />,       title: "Visible state feedback",        desc: "Every assistant state features permanent visible text labels. Colors supplement; they never substitute text." },
                { icon: <Keyboard size={18} />,      title: "Complete keyboard autonomy",    desc: "Zero keyboard traps. Every node, route, and assistant tool is fully operable without a mouse." },
              ].map((item, idx) => (
                <Reveal key={item.title} delay={idx * 50}>
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#080A0D]">
                    <span className="shrink-0 mt-0.5 text-[--accent]" aria-hidden="true">{item.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-white font-display">{item.title}</h3>
                      <p className="text-[12px] text-[#8B9096] mt-0.5 leading-relaxed font-sans">{item.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── FINAL SECTION: SIGNATURE PAYOFF & CTA ───────────────────────────── */}
      <section
        id="final-cta"
        aria-labelledby="cta-heading"
        className="py-28 border-t border-white/[0.06] relative overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(125,225,234,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-6">
          <Reveal>
            <span className="text-2xl font-bold font-display text-[#8B9096]">ubix</span>
          </Reveal>

          <Reveal delay={80}>
            <h2
              id="cta-heading"
              className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight"
            >
              YOUR CAREER.
              <br />
              CONNECTED.
            </h2>
          </Reveal>

          <Reveal delay={140}>
            <p className="text-xs sm:text-sm font-mono text-[--accent] tracking-wider uppercase">
              Resume &rarr; Skills &rarr; Learning &rarr; Practice &rarr; Opportunities
            </p>
          </Reveal>

          <Reveal delay={200}>
            <p className="text-sm text-[#8B9096] max-w-md mx-auto font-sans leading-relaxed">
              Step out of the scatter. Enter the career system designed to guide, validate, and accelerate your trajectory.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <button
                id="cta-getstarted-btn"
                type="button"
                onClick={onEnter}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[--accent] text-[#080A0D] text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-4 focus-visible:ring-offset-[#080A0D]"
              >
                <span>Get Started Now</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>

              <button
                id="cta-guest-btn"
                type="button"
                onClick={onGuestLogin}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl border border-white/10 text-sm font-semibold text-[#C7CCD1] hover:border-white/20 hover:text-white transition-all cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
              >
                Explore as Guest
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer role="contentinfo" className="border-t border-white/[0.06] py-8 bg-[#06080A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#62676D] font-sans">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[#8B9096]">ubix</span>
            <span>&bull;</span>
            <span className="font-mono text-[11px]">Connected Career Infrastructure</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 font-mono text-[11px]">
            <span>Dark-mode environment</span>
            <span>WCAG 2.1 AA</span>
            <span>Privacy-first</span>
            <span>Zero tracking ads</span>
          </div>
        </div>
      </footer>

      {/* Inline keyframe for pulse animation without modifying global sheets */}
      <style>{`
        @keyframes ubix-orb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.82); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>

    </div>
  );
}
