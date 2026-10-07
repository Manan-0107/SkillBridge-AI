"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { roleOptions } from "@/lib/data";
import { RoleId } from "@/lib/types";
import dynamic from "next/dynamic";
import type { CareerNodeId } from "@/components/ubix/UbixCareerGraph";
import { Safe3DBoundary } from "@/components/ubix/Safe3DBoundary";

const UbixCareerGraph = dynamic(
  () => import("@/components/ubix/UbixCareerGraph").then((m) => m.UbixCareerGraph),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full min-h-[580px] rounded-3xl border border-hairline bg-bg flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full border border-hairline bg-surface animate-pulse flex items-center justify-center">
            <span className="font-display font-bold text-white text-xs">ubix</span>
          </div>
          <span className="text-xs font-mono text-graphite">Loading Career Universe...</span>
        </div>
      </div>
    ),
  }
);
import { CareerRoadmap } from "@/components/roadmap/CareerRoadmap";
import { CourseCards } from "@/components/courses/CourseCards";
import { CareerTelemetry } from "@/components/progress/CareerTelemetry";
import { EvidenceWallet } from "@/components/career/EvidenceWallet";
import { CareerGapExplainer } from "@/components/career/CareerGapExplainer";
import {
  Map,
  Compass,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

export type RoadmapSubTab = "roadmap" | "journey" | "evidence" | "gaps" | "learning" | "progress";

export default function RoadmapPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as RoadmapSubTab) || "journey";
  const [activeTab, setActiveTab] = useState<RoadmapSubTab>(initialTab);
  const { user, setTargetRole } = useApp();

  const role: RoleId =
    user?.targetRole && roleOptions.some((r) => r.id === user.targetRole)
      ? (user.targetRole as RoleId)
      : "frontend";

  useEffect(() => {
    const tab = searchParams.get("tab") as RoadmapSubTab;
    if (tab && ["roadmap", "journey", "evidence", "gaps", "learning", "progress"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const navItems = [
    { id: "journey", label: "Spatial Constellation", icon: <Compass size={13} strokeWidth={2} /> },
    { id: "roadmap", label: "Phased Milestones", icon: <Map size={13} strokeWidth={2} /> },
    { id: "evidence", label: "Evidence Wallet", icon: <ShieldCheck size={13} strokeWidth={2} /> },
    { id: "gaps", label: "Gap Explainer", icon: <TrendingUp size={13} strokeWidth={2} /> },
    { id: "learning", label: "Curated Learning", icon: <BookOpen size={13} strokeWidth={2} /> },
    { id: "progress", label: "Progress Telemetry", icon: <TrendingUp size={13} strokeWidth={2} /> },
  ];

  const handleGraphNodeSelect = (nodeId: CareerNodeId | "core") => {
    if (nodeId === "roadmap") setActiveTab("roadmap");
    else if (nodeId === "learning" || nodeId === "skills") setActiveTab("learning");
    else if (nodeId === "practice") {
      if (typeof window !== "undefined") window.location.href = "/practice";
    } else if (nodeId === "jobs") {
      if (typeof window !== "undefined") window.location.href = "/jobs";
    } else if (nodeId === "resume") {
      if (typeof window !== "undefined") window.location.href = "/resume";
    } else if (nodeId === "ai") {
      if (typeof window !== "undefined") window.location.href = "/";
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-3rem)] bg-bg text-ink flex flex-col">
      {/* Sub-navigation strip */}
      <div className="border-b border-ink/8 bg-bg/90 backdrop-blur-md sticky top-12 z-30">
        <div className="app-shell flex items-center justify-between h-13 gap-3">
          {/* Sub-tabs */}
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as RoadmapSubTab)}
                  aria-pressed={active}
                  className={`group relative flex items-center gap-1.5 py-1 text-xs font-medium tracking-wide transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "text-white font-semibold"
                      : "text-ink/60 hover:text-ink"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`transition-colors ${
                      active ? "text-accent" : "text-ink/40 group-hover:text-ink/60"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute -bottom-2.5 left-0 right-0 h-[2px] bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Track selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-ink/40 hidden sm:inline uppercase tracking-wider">
              Track
            </span>
            <div className="relative flex items-center">
              <select
                value={role}
                onChange={(e) => setTargetRole(e.target.value as RoleId)}
                className="appearance-none rounded-full border border-ink/12 bg-surface/80 pl-3 pr-7 py-1.5 text-xs font-semibold text-ink focus:border-accent focus:outline-none cursor-pointer transition-colors hover:border-ink/25"
                aria-label="Target career track"
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id} className="bg-bg text-ink">
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={11}
                strokeWidth={2.5}
                className="pointer-events-none absolute right-2.5 text-ink/40"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {activeTab === "roadmap" && (
          <div className="app-shell py-8">
            <CareerRoadmap role={role} />
          </div>
        )}

        {activeTab === "journey" && (
          <div className="relative flex-1 min-h-[calc(100vh-6.25rem)] flex flex-col">
            <div className="absolute top-4 left-6 z-20 pointer-events-none">
              <span className="font-mono text-[10px] uppercase tracking-widest text-accent/80 font-semibold">
                Interactive Career Constellation
              </span>
              <p className="text-xs text-ink/50 mt-0.5">
                Select a node to inspect skills, milestones, and training drills.
              </p>
            </div>
            <Safe3DBoundary onCtaClick={handleGraphNodeSelect}>
              <UbixCareerGraph
                onNodeSelect={handleGraphNodeSelect}
                onCtaClick={handleGraphNodeSelect}
              />
            </Safe3DBoundary>
          </div>
        )}

        {activeTab === "evidence" && (
          <div className="app-shell py-8">
            <EvidenceWallet />
          </div>
        )}

        {activeTab === "gaps" && (
          <div className="app-shell py-8">
            <CareerGapExplainer roleTitle={roleOptions.find((r) => r.id === role)?.label} />
          </div>
        )}

        {activeTab === "learning" && (
          <div className="app-shell py-8">
            <CourseCards role={role} />
          </div>
        )}

        {activeTab === "progress" && (
          <div className="app-shell py-8">
            <CareerTelemetry />
          </div>
        )}
      </div>
    </main>
  );
}
