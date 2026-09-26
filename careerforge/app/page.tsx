"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { AuthGate } from "@/components/auth/AuthGate";
import { LandingPage } from "@/components/landing/LandingPage";
import { AssistantHome } from "@/components/assistant/AssistantHome";
import { Workspace } from "@/components/workspace/Workspace";
import { FeatureId, ResumeTab } from "@/lib/intent";

type View =
  | { kind: "assistant" }
  | { kind: "feature"; feature: FeatureId; resumeTab?: ResumeTab };

export default function Home() {
  const { user, signIn } = useApp();
  const [view, setView] = useState<View>({ kind: "assistant" });
  const [authViewOpen, setAuthViewOpen] = useState(false);

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

  const handleGuestLogin = async () => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "guest" }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        await signIn(data.user.email, data.user.name);
      } else {
        const guestId = Math.random().toString(36).slice(2, 8);
        await signIn(`guest_${guestId}@guest.careerforge.internal`, `Guest Explorer (${guestId.toUpperCase()})`);
      }
    } catch {
      const guestId = Math.random().toString(36).slice(2, 8);
      await signIn(`guest_${guestId}@guest.careerforge.internal`, `Guest Explorer (${guestId.toUpperCase()})`);
    }
  };

  if (!user) {
    if (authViewOpen) {
      return <AuthGate onBackToLanding={() => setAuthViewOpen(false)} />;
    }
    return (
      <main id="main-content" tabIndex={-1} className="bg-bg text-ink min-h-screen">
        <LandingPage
          onEnter={() => setAuthViewOpen(true)}
          onGuestLogin={handleGuestLogin}
        />
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="bg-bg text-ink">
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

