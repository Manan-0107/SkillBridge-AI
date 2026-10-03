"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { roleOptions } from "@/lib/data";
import { RoleId } from "@/lib/types";
import { LocalOpportunities } from "@/components/local/LocalOpportunities";
import { ResumeSuite } from "@/components/resume/ResumeSuite";
import {
  Briefcase,
  FileText,
  ChevronDown,
  CheckSquare,
  Award,
} from "lucide-react";
import { ApplicationTracker } from "@/components/career/ApplicationTracker";
import { OfferWorkspace } from "@/components/career/OfferWorkspace";

export type OpportunitiesTab = "radar" | "resume" | "applications" | "offers";

export default function OpportunitiesPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as OpportunitiesTab) || "radar";
  const [activeTab, setActiveTab] = useState<OpportunitiesTab>(initialTab);
  const { user, setTargetRole } = useApp();

  const role: RoleId =
    user?.targetRole && roleOptions.some((r) => r.id === user.targetRole)
      ? (user.targetRole as RoleId)
      : "frontend";

  useEffect(() => {
    const tab = searchParams.get("tab") as OpportunitiesTab;
    if (tab && (tab === "radar" || tab === "resume" || tab === "applications" || tab === "offers")) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-3rem)] bg-bg text-ink flex flex-col">
      {/* Sub-header Navigation Bar */}
      <div className="border-b border-ink/8 bg-bg/90 backdrop-blur-md sticky top-12 z-30">
        <div className="app-shell flex items-center justify-between h-13 gap-3">
          
          {/* Left: Opportunities Tabs */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("radar")}
              aria-pressed={activeTab === "radar"}
              className={`group relative flex items-center gap-1.5 py-1 text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                activeTab === "radar"
                  ? "text-white font-semibold"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              <Briefcase
                size={13}
                strokeWidth={2}
                className={activeTab === "radar" ? "text-accent" : "text-ink/40 group-hover:text-ink/60"}
              />
              <span>Opportunity Radar</span>
              {activeTab === "radar" && (
                <span className="absolute -bottom-2.5 left-0 right-0 h-[2px] bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("resume")}
              aria-pressed={activeTab === "resume"}
              className={`group relative flex items-center gap-1.5 py-1 text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                activeTab === "resume"
                  ? "text-white font-semibold"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              <FileText
                size={13}
                strokeWidth={2}
                className={activeTab === "resume" ? "text-accent" : "text-ink/40 group-hover:text-ink/60"}
              />
              <span>Resume Studio</span>
              {activeTab === "resume" && (
                <span className="absolute -bottom-2.5 left-0 right-0 h-[2px] bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("applications")}
              aria-pressed={activeTab === "applications"}
              className={`group relative flex items-center gap-1.5 py-1 text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                activeTab === "applications"
                  ? "text-white font-semibold"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              <CheckSquare
                size={13}
                strokeWidth={2}
                className={activeTab === "applications" ? "text-accent" : "text-ink/40 group-hover:text-ink/60"}
              />
              <span>Applications</span>
              {activeTab === "applications" && (
                <span className="absolute -bottom-2.5 left-0 right-0 h-[2px] bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("offers")}
              aria-pressed={activeTab === "offers"}
              className={`group relative flex items-center gap-1.5 py-1 text-xs font-medium tracking-wide transition-colors cursor-pointer ${
                activeTab === "offers"
                  ? "text-white font-semibold"
                  : "text-ink/60 hover:text-ink"
              }`}
            >
              <Award
                size={13}
                strokeWidth={2}
                className={activeTab === "offers" ? "text-accent" : "text-ink/40 group-hover:text-ink/60"}
              />
              <span>Offer Workspace</span>
              {activeTab === "offers" && (
                <span className="absolute -bottom-2.5 left-0 right-0 h-[2px] bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
              )}
            </button>
          </div>

          {/* Right: Subtle Track Selector */}
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 py-4">
        {activeTab === "radar" && <LocalOpportunities />}
        {activeTab === "resume" && (
          <ResumeSuite role={role} initialTab="builder" />
        )}
        {activeTab === "applications" && (
          <div className="app-shell flex-1">
            <ApplicationTracker />
          </div>
        )}
        {activeTab === "offers" && (
          <div className="app-shell flex-1">
            <OfferWorkspace />
          </div>
        )}
      </div>
    </main>
  );
}
