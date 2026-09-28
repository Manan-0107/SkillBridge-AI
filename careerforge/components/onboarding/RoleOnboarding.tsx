"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { roleOptions } from "@/lib/data";
import { RoleId } from "@/lib/types";
import { PrimaryButton } from "@/components/ui/Primitives";

export function RoleOnboarding() {
  const { user, setTargetRole } = useApp();
  const [selected, setSelected] = useState<RoleId | null>(null);

  const confirm = () => {
    if (selected) setTargetRole(selected);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-16 text-ink">
      <div className="w-full max-w-xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink/60">
          Step 1 of 1
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink md:text-4xl">
          Welcome, {user?.name?.split(" ")[0]}. What are you aiming for?
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          This drives your roadmap, curated courses, and resume feedback below.
          You can change it any time.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roleOptions.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelected(role.id)}
              className={`rounded-xl border px-4 py-4 text-left transition-colors cursor-pointer ${
                selected === role.id
                  ? "border-accent bg-surface text-ink ring-1 ring-accent"
                  : "border-ink/15 bg-surface/60 text-ink hover:border-ink/30 hover:bg-surface"
              }`}
            >
              <p className="text-sm font-semibold text-ink">{role.label}</p>
              <p
                className={`mt-1 text-xs ${
                  selected === role.id ? "text-ink/80" : "text-ink/60"
                }`}
              >
                {role.blurb}
              </p>
            </button>
          ))}
        </div>

        <PrimaryButton
          onClick={confirm}
          disabled={!selected}
          className="mt-8 w-full"
        >
          Continue to workspace
        </PrimaryButton>
      </div>
    </div>
  );
}
