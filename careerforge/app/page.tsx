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

  if (!ready) return null;
  if (!user) return <AuthGate />;

  const current = view.kind === "assistant" ? "assistant" : view.feature;

  return (
    <main className="min-h-screen bg-paper">
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
