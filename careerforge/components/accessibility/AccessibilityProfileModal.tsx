"use client";

import React, { useState, useEffect } from "react";
import { useApp, AccessibilityProfile } from "@/lib/store";

export function AccessibilityProfileModal() {
  const { accessibilityProfile, setAccessibilityProfile } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<AccessibilityProfile>("standard");

  useEffect(() => {
    try {
      const chosen = localStorage.getItem("careerforge_profile_selected");
      if (!chosen) {
        setIsOpen(true);
      }
    } catch {}
  }, []);

  const handleConfirm = (choice: AccessibilityProfile) => {
    setAccessibilityProfile(choice);
    try {
      localStorage.setItem("careerforge_profile_selected", "true");
    } catch {}
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
      aria-describedby="a11y-modal-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-xl rounded-3xl border-2 border-accent/20 bg-bg p-6 sm:p-8 text-ink shadow-2xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Personalized Accessibility Experience
          </p>
          <h2 id="a11y-modal-title" className="text-2xl font-bold text-ink tracking-tight">
            How would you like to experience CareerForge?
          </h2>
          <p id="a11y-modal-desc" className="text-sm text-ink/80 leading-relaxed">
            CareerForge adapts to your needs. This choice configures microphone usage, voice detection, and visual accessibility. You can change this at any time in Settings.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5" role="radiogroup" aria-label="Accessibility Profiles">
          {/* Profile 1: Blind / Low Vision */}
          <button
            type="button"
            role="radio"
            aria-checked={selected === "blind_low_vision"}
            onClick={() => setSelected("blind_low_vision")}
            className={`rounded-2xl border-2 p-4 text-left transition-all focus-visible:ring-4 focus-visible:ring-accent ${
              selected === "blind_low_vision"
                ? "border-accent bg-surface text-ink shadow-sm"
                : "border-ink/15 bg-bg/60 text-ink/80 hover:border-accent/40 hover:bg-surface/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">👁️</span>
                <span className="font-bold text-base text-ink">Blind or Low Vision</span>
              </div>
              {selected === "blind_low_vision" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent text-white">
                  Selected
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-ink/75 leading-relaxed">
              Ambient, always-on voice assistant active across all pages. Spoken audio feedback (TTS), screen-reader live announcements, and accessible sequential lists.
            </p>
          </button>

          {/* Profile 2: Deaf / Hard of Hearing */}
          <button
            type="button"
            role="radio"
            aria-checked={selected === "deaf_hard_of_hearing"}
            onClick={() => setSelected("deaf_hard_of_hearing")}
            className={`rounded-2xl border-2 p-4 text-left transition-all focus-visible:ring-4 focus-visible:ring-accent ${
              selected === "deaf_hard_of_hearing"
                ? "border-accent bg-surface text-ink shadow-sm"
                : "border-ink/15 bg-bg/60 text-ink/80 hover:border-accent/40 hover:bg-surface/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">🦻</span>
                <span className="font-bold text-base text-ink">Deaf or Hard of Hearing</span>
              </div>
              {selected === "deaf_hard_of_hearing" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent text-white">
                  Selected
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-ink/75 leading-relaxed">
              <strong>Zero microphone access:</strong> Voice recording and mic prompts are completely unmounted and eliminated. Purely visual interface with synchronized live captions and visual status cues.
            </p>
          </button>

          {/* Profile 3: Standard Experience */}
          <button
            type="button"
            role="radio"
            aria-checked={selected === "standard"}
            onClick={() => setSelected("standard")}
            className={`rounded-2xl border-2 p-4 text-left transition-all focus-visible:ring-4 focus-visible:ring-accent ${
              selected === "standard"
                ? "border-accent bg-surface text-ink shadow-sm"
                : "border-ink/15 bg-bg/60 text-ink/80 hover:border-accent/40 hover:bg-surface/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">💻</span>
                <span className="font-bold text-base text-ink">Standard Experience</span>
              </div>
              {selected === "standard" && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent text-white">
                  Selected
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-ink/75 leading-relaxed">
              Standard workspace. Voice assistant is optional and turned <strong>off by default</strong> with zero microphone permission prompts until you explicitly click to enable it.
            </p>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleConfirm("standard")}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-ink/20 bg-surface/60 text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => handleConfirm(selected)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent text-white font-bold text-sm shadow-md hover:bg-accent-soft transition-all focus-visible:ring-4 focus-visible:ring-accent"
          >
            Confirm &amp; Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
