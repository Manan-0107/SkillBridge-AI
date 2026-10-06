"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  FileText,
  Target,
  BookOpen,
  Code2,
  Briefcase,
  Map,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import type { CareerNodeId } from "./UbixCareerGraph";

interface Safe3DBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onCtaClick?: (nodeId: CareerNodeId | "core") => void;
}

interface Safe3DBoundaryState {
  hasError: boolean;
  webGlAvailable: boolean;
}

const STATIC_CAREER_STAGES: Array<{
  id: CareerNodeId;
  label: string;
  category: string;
  desc: string;
  icon: typeof FileText;
}> = [
  {
    id: "resume",
    label: "Resume",
    category: "Profile Intelligence",
    desc: "Understand verified competencies and ATS alignment.",
    icon: FileText,
  },
  {
    id: "skills",
    label: "Skill Gap",
    category: "Gap Analysis",
    desc: "Discover missing proficiencies for your target roles.",
    icon: Target,
  },
  {
    id: "learning",
    label: "Learning",
    category: "Adaptive Curriculum",
    desc: "Focused micro-curriculums addressing only verified gaps.",
    icon: BookOpen,
  },
  {
    id: "practice",
    label: "Practice",
    category: "Validation",
    desc: "Real-world engineering drills and interview simulations.",
    icon: Code2,
  },
  {
    id: "jobs",
    label: "Jobs",
    category: "Opportunity Matching",
    desc: "Verified career roles matching demonstrated capabilities.",
    icon: Briefcase,
  },
  {
    id: "roadmap",
    label: "Roadmap",
    category: "Trajectory",
    desc: "Dynamic career milestones that evolve as you progress.",
    icon: Map,
  },
  {
    id: "ai",
    label: "Assistant",
    category: "Intelligence Layer",
    desc: "Continuous assistant connecting your entire journey.",
    icon: Sparkles,
  },
];

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export class Safe3DBoundary extends Component<Safe3DBoundaryProps, Safe3DBoundaryState> {
  constructor(props: Safe3DBoundaryProps) {
    super(props);
    const webGlAvailable = checkWebGLSupport();
    this.state = {
      hasError: !webGlAvailable,
      webGlAvailable,
    };
  }

  static getDerivedStateFromError(): Partial<Safe3DBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Isolated log without leaking sensitive traces to UI
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Safe3DBoundary] 3D component failure isolated:", error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
          <div
            role="region"
            aria-label="Career System Overview (Accessible Static Fallback)"
            className="relative w-full min-h-[580px] sm:min-h-[680px] lg:min-h-[760px] rounded-3xl border border-hairline bg-bg/90 backdrop-blur-xl p-6 sm:p-10 flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient background glaze */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                background:
                  "radial-gradient(circle at 50% 30%, rgba(125, 225, 234, 0.08), transparent 70%)",
              }}
            />

            {/* Header notification */}
            <div className="relative z-10 max-w-2xl mx-auto text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-hairline bg-surface text-xs font-mono text-graphite">
                <AlertCircle size={13} className="text-[--accent]" />
                <span>Standard Accessible Mode</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                {this.props.fallbackTitle || "Continuous Career System"}
              </h3>
              <p className="text-xs sm:text-sm text-graphite max-w-lg mx-auto">
                Interactive 3D visualization is unavailable on your current display or environment.
                All career systems and stages remain fully accessible below.
              </p>
            </div>

            {/* Accessible 7-stage grid */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 my-8 max-w-5xl mx-auto w-full">
              {STATIC_CAREER_STAGES.map((stage) => {
                const Icon = stage.icon;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => this.props.onCtaClick?.(stage.id)}
                    className="group flex flex-col justify-between p-4.5 rounded-2xl border border-hairline-subtle bg-surface/70 hover:bg-surface-elevated hover:border-hairline transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[--accent]">
                        {stage.category}
                      </span>
                      <Icon size={16} className="text-graphite group-hover:text-white transition-colors" />
                    </div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-[--accent] transition-colors mb-1">
                      {stage.label}
                    </h4>
                    <p className="text-xs text-graphite leading-relaxed mb-3">
                      {stage.desc}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/70 group-hover:text-white transition-colors mt-auto">
                      <span>Enter stage</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Central CTA */}
            <div className="relative z-10 text-center">
              <button
                type="button"
                onClick={() => this.props.onCtaClick?.("core")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[--accent] text-bg text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
              >
                <span>Enter Career System</span>
                <ArrowRight size={15} />
              </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}
