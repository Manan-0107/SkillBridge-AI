"use client";

import React from "react";
import { Concept } from "@/types/roadmap";
import { getItem, setItem, buildStorageKey } from "@/lib/storage";
import { ChecklistState } from "@/types/storage";

interface ConceptChecklistProps {
  roadmapId: string;
  nodeId: string;
  concepts: Concept[];
  onChecklistChange?: (completedConceptIds: string[]) => void;
  className?: string;
}

export function ConceptChecklist({
  roadmapId,
  nodeId,
  concepts,
  onChecklistChange,
  className = "",
}: ConceptChecklistProps) {
  const storageKey = buildStorageKey(roadmapId, "checklist");

  // Load from local storage
  const [completedIds, setCompletedIds] = React.useState<string[]>(() => {
    const stored = getItem<ChecklistState>(storageKey, {
      version: 1,
      checkedConcepts: {},
      updatedAt: new Date().toISOString(),
    });
    return stored.checkedConcepts[nodeId] || [];
  });

  const toggleConcept = (conceptId: string) => {
    const updated = completedIds.includes(conceptId)
      ? completedIds.filter((id) => id !== conceptId)
      : [...completedIds, conceptId];

    setCompletedIds(updated);

    // Persist to localStorage synchronously
    const stored = getItem<ChecklistState>(storageKey, {
      version: 1,
      checkedConcepts: {},
      updatedAt: new Date().toISOString(),
    });

    const nextState: ChecklistState = {
      version: 1,
      checkedConcepts: {
        ...stored.checkedConcepts,
        [nodeId]: updated,
      },
      updatedAt: new Date().toISOString(),
    };

    setItem(storageKey, nextState);
    onChecklistChange?.(updated);
  };

  const percentage =
    concepts.length > 0
      ? Math.round((completedIds.length / concepts.length) * 100)
      : 0;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-charcoal-400 uppercase tracking-wider">Concept Verification</span>
        <span className="text-accent-400 font-semibold">{percentage}% Done</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-charcoal-800 overflow-hidden">
        <div
          className="h-full bg-accent-500 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Checklist items */}
      <ul className="space-y-2 mt-2">
        {concepts.map((c) => {
          const isChecked = completedIds.includes(c.id);
          return (
            <li key={c.id}>
              <label className="flex items-start gap-3 p-2.5 rounded-xl border border-hairline bg-charcoal-900/60 hover:bg-charcoal-900 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleConcept(c.id)}
                  className="mt-0.5 h-4 w-4 rounded-md border-charcoal-600 bg-charcoal-800 text-accent-500 focus:ring-accent-400 accent-amber-500 cursor-pointer"
                />
                <span
                  className={`text-xs leading-relaxed transition-colors ${
                    isChecked
                      ? "text-charcoal-500 line-through"
                      : "text-charcoal-200"
                  }`}
                >
                  {c.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
