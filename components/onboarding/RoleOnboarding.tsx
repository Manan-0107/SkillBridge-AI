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
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-16">
      <div className="w-full max-w-xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite">
          Step 1 of 1
        </p>
        <h1 className="mt-3 font-display text-3xl italic text-ink md:text-4xl">
          Welcome, {user?.name?.split(" ")[0]}. What are you aiming for?
        </h1>
        <p className="mt-3 text-sm text-graphite">
          This drives your roadmap, curated courses, and resume feedback below.
          You can change it any time.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roleOptions.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelected(role.id)}
              className={`rounded-lg border px-4 py-4 text-left transition-colors ${
                selected === role.id
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-white/50 text-ink hover:border-ink/50"
              }`}
            >
              <p className="text-sm font-semibold">{role.label}</p>
              <p
                className={`mt-1 text-xs ${
                  selected === role.id ? "text-paper/70" : "text-graphite"
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
