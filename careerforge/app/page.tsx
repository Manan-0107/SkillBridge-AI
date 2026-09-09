"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { AuthGate } from "@/components/auth/AuthGate";
import { TopNav } from "@/components/nav/TopNav";
import { AssistantHome } from "@/components/assistant/AssistantHome";
import { Workspace } from "@/components/workspace/Workspace";
import { FeatureId, ResumeTab } from "@/lib/intent";

type View =
  | { kind: "assistant" }
  | { kind: "feature"; feature: FeatureId; resumeTab?: ResumeTab };

export default function Home() {
  const { user, ready } = useApp();
  const [view, setView] = useState<View>({ kind: "assistant" });

  useEffect(() => {
    if (!user) setView({ kind: "assistant" });
  }, [user]);

  useEffect(() => {
    const handleNav = (e: CustomEvent<{ feature: FeatureId | "assistant"; resumeTab?: ResumeTab }>) => {
      const { feature, resumeTab } = e.detail || {};
      if (feature === "assistant") {
        setView({ kind: "assistant" });
      } else if (feature) {
        setView({ kind: "feature", feature, resumeTab });
      }
    };

    window.addEventListener("careerforge:navigate" as any, handleNav);
    return () => window.removeEventListener("careerforge:navigate" as any, handleNav);
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold text-xl shadow-md animate-pulse">
            CF
          </div>
          <p className="text-sm font-medium text-neutral-600">Loading CareerForge workspace...</p>
        </div>
      </main>
    );
  }

  if (!user) return <AuthGate />;

  const current = view.kind === "assistant" ? "assistant" : view.feature;

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-paper">
      <TopNav
        view={current}
        onAssistant={() => setView({ kind: "assistant" })}
        onFeature={(feature) => setView({ kind: "feature", feature })}
      />

      {view.kind === "assistant" ? (
        <AssistantHome
          onRedirect={(feature, resumeTab) =>
            setView({ kind: "feature", feature, resumeTab })
          }
        />
      ) : (
        <Workspace feature={view.feature} resumeTab={view.resumeTab} />
      )}
    </main>
  );
}
