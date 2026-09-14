"use client";

import React from "react";
import Link from "next/link";
import { InteractiveRoadmap } from "@/components/roadmap/InteractiveRoadmap";

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-[#0a0c12] text-slate-100 selection:bg-amber-400 selection:text-black">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0c0e15]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group"
            >
              <span className="text-slate-500 group-hover:-translate-x-0.5 transition-transform duration-150">
                ←
              </span>
              <span>Workspace</span>
            </Link>
            <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-inner text-amber-400">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <path d="M6 9v12" />
                  <path d="M18 9v6" />
                  <path d="M9 6h6" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-white text-sm sm:text-base leading-tight tracking-tight">
                  CareerForge <span className="text-slate-400 font-normal">/ Interactive Learning Roadmaps</span>
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:block">
                  Graph-based curriculum, milestones &amp; dependency trees
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-slate-900/90 border border-slate-800 text-slate-400 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Offline Ready · Zero-Runtime-DB</span>
            </div>

            <Link
              href="/practice-engine"
              className="px-3.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/70 text-xs font-medium text-slate-200 hover:text-white transition-all shadow-sm"
            >
              Daily Practice Drills
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8">
        <InteractiveRoadmap
          apiEndpoint="/api/roadmap"
          initialCategory="data-ai"
          className="border border-slate-800/90 shadow-2xl"
        />
      </div>
    </main>
  );
}

