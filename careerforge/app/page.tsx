"use client";

import { useApp } from "@/lib/store";
import { AuthGate } from "@/components/auth/AuthGate";
import { RoleOnboarding } from "@/components/onboarding/RoleOnboarding";
import { TopNav } from "@/components/nav/TopNav";
import { ResumeSuite } from "@/components/resume/ResumeSuite";
import { CareerRoadmap } from "@/components/roadmap/CareerRoadmap";
import { CourseCards } from "@/components/courses/CourseCards";
import { PracticeHub } from "@/components/practice/PracticeHub";
import { LocalOpportunities } from "@/components/local/LocalOpportunities";

export default function Home() {
  const { user, ready } = useApp();

  if (!ready) return null;
  if (!user) return <AuthGate />;
  if (!user.targetRole) return <RoleOnboarding />;

  return (
    <main className="min-h-screen bg-paper">
      <TopNav />

      <div className="border-b border-line py-14 md:py-20">
        <div className="mx-auto max-w-content px-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite">
            Workspace
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl italic text-ink md:text-5xl">
            Everything for your next role, in one quiet place.
          </h1>
        </div>
      </div>

      <ResumeSuite role={user.targetRole} />
      <div className="border-t border-line" />
      <CareerRoadmap role={user.targetRole} />
      <div className="border-t border-line" />
      <CourseCards role={user.targetRole} />
      <div className="border-t border-line" />
      <PracticeHub />
      <div className="border-t border-line" />
      <LocalOpportunities />

      <footer className="border-t border-line py-10">
        <div className="mx-auto max-w-content px-6 text-xs text-graphite">
          CareerForge — built for the next role, not the last one.
        </div>
      </footer>
    </main>
  );
}
