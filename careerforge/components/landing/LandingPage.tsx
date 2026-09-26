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
  Map,
  Code2,
  FileText,
  Briefcase,
  TrendingUp,
} from "lucide-react";

// ─── Three.js Hero — dynamically imported, SSR disabled, landing-page only ───
const UbixHeroScene = dynamic(
  () => import("@/components/ubix/UbixHeroScene").then((m) => m.UbixHeroScene),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[380px] sm:h-[460px] lg:h-[540px] flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="w-16 h-16 rounded-full border border-white/10 bg-[#121518]" />
      </div>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Data ─────────────────────────────────────────────────────────────────────
const ASSISTANT_STATES: AssistantState[] = [
  { id: "idle",       label: "Idle",             sublabel: "Ready when you are.",             orbColor: "#8B9096",  orbPulse: false },
  { id: "listening",  label: "Listening\u2026",   sublabel: "Voice input active. Speak now.",  orbColor: "var(--accent)",  orbPulse: true  },
  { id: "thinking",   label: "Thinking\u2026",    sublabel: "Analysing your question.",         orbColor: "#A5ABB2",        orbPulse: true  },
  { id: "processing", label: "Processing\u2026",  sublabel: "Finding relevant information.",    orbColor: "var(--accent)",  orbPulse: true  },
  { id: "answer",     label: "Answer ready",     sublabel: "Response generated.",              orbColor: "#34D399",  orbPulse: false },
  { id: "action",     label: "Action completed", sublabel: "Task executed successfully.",      orbColor: "#34D399",  orbPulse: false },
];

const JOURNEY_STEPS = [
  { label: "Goal",       desc: "Define aspiration & seniority tier" },
  { label: "AI Profile", desc: "Synthesise background & strengths" },
  { label: "Skill Gaps", desc: "Compute exact missing proficiencies" },
  { label: "Roadmap",    desc: "Generate sequenced milestone curriculum" },
  { label: "Learning",   desc: "Master verified fundamentals" },
  { label: "Practice",   desc: "Targeted coding & behavioral drills" },
  { label: "Progress",   desc: "Benchmark readiness in real-time" },
  { label: "Resume",     desc: "Engineer ATS-optimised documents" },
  { label: "Jobs",       desc: "Match with vetted employers" },
  { label: "Growth",     desc: "Sustain lifelong mastery" },
];

const ECOSYSTEM_NODES = [
  { icon: <Map size={16} />,      label: "Roadmap"  },
  { icon: <Target size={16} />,   label: "Skills"   },
  { icon: <Code2 size={16} />,    label: "Learning" },
  { icon: <Code2 size={16} />,    label: "Practice" },
  { icon: <FileText size={16} />, label: "Resume"   },
  { icon: <Briefcase size={16} />,label: "Jobs"     },
  { icon: <TrendingUp size={16} />,label: "Progress"},
  { icon: <Volume2 size={16} />,  label: "Voice"    },
];

// ─── IntersectionObserver reveal hook ────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
        transform: visible ? "translateY(0)" : "translateY(18px)",
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

// ─── Main component ───────────────────────────────────────────────────────────
export function LandingPage({ onEnter, onGuestLogin }: LandingPageProps) {
  const [activeState, setActiveState] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setActiveState((s) => (s + 1) % ASSISTANT_STATES.length),
      2200
    );
    return () => clearInterval(id);
  }, []);

  const state = ASSISTANT_STATES[activeState];

  return (
    <div className="w-full text-ink selection:bg-surface selection:text-ink">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#080A0D]/90 backdrop-blur-md"
        role="banner"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <a
            href="#"
            aria-label="ubix home"
            className="font-display text-xl font-bold tracking-tight text-white select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0D] rounded-sm"
          >
            ubix
          </a>

          <nav
            aria-label="Landing navigation"
            className="hidden md:flex items-center gap-6 text-sm text-[#8B9096] font-medium font-sans"
          >
            {[
              { href: "#product",      label: "Product"        },
              { href: "#how-it-works", label: "How it works"   },
              { href: "#accessibility",label: "Accessibility"  },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] rounded-sm"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              id="nav-signin-btn"
              type="button"
              onClick={onEnter}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#C7CCD1] hover:text-white transition-colors cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0D]"
            >
              Sign In
            </button>
            <button
              id="nav-getstarted-btn"
              type="button"
              onClick={onEnter}
              className="px-4 py-1.5 rounded-lg bg-[--accent] text-[#080A0D] text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0D]"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ── SECTION 1: HERO ──────────────────────────────────────────────────── */}
      <section id="hero" aria-labelledby="hero-heading" className="relative pt-16 pb-24 sm:pt-24 sm:pb-32 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">

            {/* Copy */}
            <div className="lg:col-span-6 space-y-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-[#121518] text-xs text-[#8B9096] font-medium font-sans">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[--accent]" style={{ animation: "ubix-orb-pulse 2s ease-in-out infinite" }} />
                Quiet, intelligent career infrastructure
              </div>

              <h1 id="hero-heading" className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.04]">
                ubix
              </h1>

              <p className="text-base sm:text-lg text-[#A5ABB2] font-sans leading-relaxed max-w-md mx-auto lg:mx-0">
                Goal &rarr; Skills &rarr; Learning &rarr; Practice &rarr; Resume &rarr; Opportunities &rarr; Growth
              </p>

              <p className="text-sm text-[#8B9096] font-sans leading-relaxed max-w-md mx-auto lg:mx-0">
                One focused workspace that closes the gap between where you are and where you want to be.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-1">
                <button
                  id="hero-getstarted-btn"
                  type="button"
                  onClick={onEnter}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[--accent] text-[#080A0D] text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0D]"
                >
                  <span>Get Started</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button
                  id="hero-guest-btn"
                  type="button"
                  onClick={onGuestLogin}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-[#C7CCD1] hover:border-white/20 hover:text-white transition-all cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0D]"
                >
                  Try as Guest
                </button>
              </div>
            </div>

            {/* Three.js hero — mobile gets static placeholder */}
            <div className="lg:col-span-6 relative flex items-center justify-center" aria-hidden="true">
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(125,225,234,0.055) 0%, transparent 70%)" }}
              />
              <div className="relative w-full rounded-2xl border border-white/[0.06] bg-[#0D0F12] overflow-hidden">
                {isMobile ? (
                  <div className="w-full h-64 flex items-center justify-center">
                    <div
                      className="w-24 h-24 rounded-full border border-white/[0.08]"
                      style={{ background: "radial-gradient(circle at 35% 35%, #1A1F24 0%, #0D0F12 100%)" }}
                    />
                  </div>
                ) : (
                  <UbixHeroScene />
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 2: PROBLEM ───────────────────────────────────────────────── */}
      <section id="problem" aria-labelledby="problem-heading" className="py-20 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Reveal>
            <span className="text-xs uppercase tracking-widest text-[--accent] font-semibold font-sans">The real problem</span>
          </Reveal>
          <Reveal delay={80}>
            <h2 id="problem-heading" className="mt-4 font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              Career tools are scattered. The path is unclear.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-[#A5ABB2] text-base sm:text-lg leading-relaxed font-sans">
              Most technologists navigate career growth across a dozen disconnected tools — one for resumes, another for courses, a third for practice problems. Nobody tells you which skills are actually missing, or in what order to learn them.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <p className="mt-4 text-[#8B9096] text-sm sm:text-base leading-relaxed font-sans">
              Skill gaps stay invisible until a rejection letter arrives. Interview preparation happens in isolation from resume engineering. Job discovery ignores what you have actually built. And for candidates with accessibility needs, every extra tool is another barrier.
            </p>
          </Reveal>
          <Reveal delay={280}>
            <p className="mt-4 text-[#8B9096] text-sm sm:text-base leading-relaxed font-sans">
              ubix replaces the scatter with one connected system that knows your background, your goal, and your exact gaps — and works with you to close them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── SECTION 3: JOURNEY ───────────────────────────────────────────────── */}
      <section id="how-it-works" aria-labelledby="journey-heading" className="py-20 border-t border-white/[0.06] bg-[#0D0F12]/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase tracking-widest text-[--accent] font-semibold font-sans">How it works</span>
            <h2 id="journey-heading" className="mt-4 font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
              One continuous career system
            </h2>
            <p className="mt-3 text-[#8B9096] text-sm leading-relaxed font-sans">
              Every stage connects. What you learn updates your roadmap. What you build updates your resume. Progress is never siloed.
            </p>
          </Reveal>

          {/* Pipeline */}
          <div role="list" aria-label="Career journey stages">
            {/* Desktop: horizontal row */}
            <div className="hidden lg:flex items-start gap-0 relative">
              <div aria-hidden="true" className="absolute top-[1.25rem] left-5 right-5 h-px bg-white/[0.06]" />
              {JOURNEY_STEPS.map((step, idx) => (
                <Reveal key={step.label} delay={idx * 50} className="relative flex-1 flex flex-col items-center text-center px-1">
                  <div role="listitem">
                    <div
                      aria-hidden="true"
                      className="relative z-10 mx-auto w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] font-mono font-bold mb-3"
                      style={{
                        borderColor: idx === 0 ? "var(--accent)" : "rgba(255,255,255,0.08)",
                        color:       idx === 0 ? "var(--accent)" : "#8B9096",
                        background: "#080A0D",
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <h3 className="text-[11px] font-semibold text-white font-display mb-1">{step.label}</h3>
                    <p className="text-[10px] text-[#62676D] leading-snug font-sans">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Mobile: vertical list */}
            <div className="lg:hidden space-y-3">
              {JOURNEY_STEPS.map((step, idx) => (
                <Reveal key={step.label} delay={idx * 40}>
                  <div
                    role="listitem"
                    className="flex items-start gap-4 p-3.5 rounded-xl border border-white/[0.06] bg-[#0D0F12]"
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold"
                      style={{
                        borderColor: idx === 0 ? "var(--accent)" : "rgba(255,255,255,0.08)",
                        color:       idx === 0 ? "var(--accent)" : "#8B9096",
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white font-display">{step.label}</h3>
                      <p className="text-xs text-[#8B9096] font-sans mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={200} className="mt-12 text-center">
            <button
              id="journey-getstarted-btn"
              type="button"
              onClick={onEnter}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[--accent] text-[#080A0D] text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080A0D]"
            >
              <span>Start your journey</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ── SECTION 4: ASSISTANT ─────────────────────────────────────────────── */}
      <section id="assistant" aria-labelledby="assistant-heading" className="py-20 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-5 space-y-5">
              <Reveal>
                <span className="text-xs uppercase tracking-widest text-[--accent] font-semibold font-sans">ubix Assistant</span>
              </Reveal>
              <Reveal delay={80}>
                <h2 id="assistant-heading" className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
                  Intelligence that answers, acts, and adapts
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="text-[#A5ABB2] text-sm leading-relaxed font-sans">
                  The ubix Assistant handles general questions, research, technical deep-dives, coding walkthroughs, skill-gap analysis, roadmap generation, resume feedback, and job discovery — all in one conversation, with full voice and keyboard access.
                </p>
              </Reveal>
              <Reveal delay={200}>
                <p className="text-[#8B9096] text-sm leading-relaxed font-sans">
                  Every assistant state carries a visible text label. Color and animation supplement the label — they never replace it.
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delay={100}>
                <div
                  className="rounded-2xl border border-white/[0.06] bg-[#0D0F12] overflow-hidden"
                  aria-label="Assistant state demonstration"
                >
                  {/* Active state — aria-live for screen readers */}
                  <div
                    className="p-6 border-b border-white/[0.06] flex items-start gap-4"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <StateOrb color={state.orbColor} pulse={state.orbPulse} />
                    <div>
                      {/* MANDATORY visible text label */}
                      <p className="text-sm font-semibold text-white font-display">{state.label}</p>
                      <p className="text-xs text-[#8B9096] mt-0.5 font-sans">{state.sublabel}</p>
                    </div>
                  </div>

                  {/* All 6 state selector buttons */}
                  <div role="group" aria-label="Select assistant state" className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-white/[0.04]">
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
                        {/* Textual label always visible */}
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

      {/* ── SECTION 5: ACCESSIBILITY ─────────────────────────────────────────── */}
      <section id="accessibility" aria-labelledby="a11y-heading" className="py-20 border-t border-white/[0.06] bg-[#0D0F12]/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

            <div className="lg:col-span-5 space-y-5">
              <Reveal>
                <span className="text-xs uppercase tracking-widest text-[--accent] font-semibold font-sans">Accessibility-first</span>
              </Reveal>
              <Reveal delay={80}>
                <h2 id="a11y-heading" className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
                  Engineered for complete independence
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="text-[#A5ABB2] text-sm leading-relaxed font-sans">
                  Most career platforms treat accessibility as a retrofit. ubix is designed from the start so that blind, low-vision, deaf, and motor-impaired technologists operate with full autonomy — no workarounds required.
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-7 space-y-3">
              {[
                { icon: <Volume2 size={18} />,     title: "Voice interaction & dictation",    desc: "Hands-free workspace navigation, route dispatch, audiobook roadmap playback, and real-time voice dictation across all inputs." },
                { icon: <MessageSquare size={18} />,title: "Captions & transcripts",           desc: "Every audio output and assistant response is available as simultaneous on-screen text for deaf and hard-of-hearing users." },
                { icon: <Eye size={18} />,          title: "Screen-reader support",            desc: "Full ARIA 1.2 semantic tree, live regions for all assistant state changes, and descriptive labels on every interactive control." },
                { icon: <Mic size={18} />,          title: "Spoken confirmation",              desc: "Critical actions — submit, navigate, delete — are confirmed aloud so users with visual impairments always know what happened." },
                { icon: <Sliders size={18} />,      title: "Visible state feedback",           desc: "Every assistant state has a permanent visible text label. Color supplements; it never replaces text." },
                { icon: <Keyboard size={18} />,     title: "Full keyboard accessibility",      desc: "Zero keyboard traps. Every route, assistant action, and settings control is reachable without a pointer device." },
              ].map((item, idx) => (
                <Reveal key={item.title} delay={idx * 55}>
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

      {/* ── SECTION 6: ECOSYSTEM ─────────────────────────────────────────────── */}
      <section id="ecosystem" aria-labelledby="ecosystem-heading" className="py-20 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase tracking-widest text-[--accent] font-semibold font-sans">Ecosystem</span>
            <h2 id="ecosystem-heading" className="mt-4 font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
              One product. Nine connected layers.
            </h2>
            <p className="mt-3 text-[#8B9096] text-sm leading-relaxed font-sans">
              The Assistant sits at the centre as the intelligence layer connecting every capability. Nothing operates in isolation.
            </p>
          </Reveal>

          <div
            className="max-w-3xl mx-auto"
            role="img"
            aria-label="Ecosystem diagram: Assistant at centre connected to Roadmap, Skills, Learning, Practice, Resume, Jobs, Progress, and Voice"
          >
            {/* Centre node */}
            <Reveal className="flex justify-center mb-8">
              <div
                className="relative w-28 h-28 rounded-full border-2 flex flex-col items-center justify-center bg-[#0D0F12] text-center"
                style={{ borderColor: "var(--accent)", boxShadow: "0 0 40px -8px rgba(125,225,234,0.15)" }}
              >
                <span className="text-[--accent]" aria-hidden="true"><MessageSquare size={22} /></span>
                <span className="text-xs font-bold text-white mt-1 font-display">Assistant</span>
                <span className="text-[9px] text-[--accent] font-sans mt-0.5 leading-tight">intelligence layer</span>
              </div>
            </Reveal>

            {/* Outer nodes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ECOSYSTEM_NODES.map((node, idx) => (
                <Reveal key={node.label} delay={idx * 45}>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/[0.06] bg-[#0D0F12] text-center">
                    <span className="text-[#8B9096]" aria-hidden="true">{node.icon}</span>
                    <span className="text-xs font-medium text-[#C7CCD1] font-sans">{node.label}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: CTA ───────────────────────────────────────────────────── */}
      <section id="cta" aria-labelledby="cta-heading" className="py-24 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <Reveal>
            <h2 id="cta-heading" className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Start building your career infrastructure.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-8">
              <button
                id="cta-getstarted-btn"
                type="button"
                onClick={onEnter}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[--accent] text-[#080A0D] text-base font-bold hover:opacity-90 transition-opacity cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-4 focus-visible:ring-offset-[#080A0D]"
              >
                <span>Get Started</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer role="contentinfo" className="border-t border-white/[0.06] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#62676D] font-sans">
          <span className="font-display font-bold text-[#8B9096]">ubix</span>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <span>Dark-mode environment</span>
            <span>WCAG 2.1 AA</span>
            <span>Privacy-first</span>
            <span>Zero tracking ads</span>
          </div>
        </div>
      </footer>

      {/* Inline keyframe — avoids modifying any authenticated stylesheet */}
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
