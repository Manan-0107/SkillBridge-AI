"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/lib/store";
import { RoleId } from "@/lib/types";
import {
  speakText,
  stopSpeaking,
  startSpeechRecognition,
  SpeechRecognitionController,
  playAccessibleChime,
  spellOutWord,
} from "@/lib/voice";

interface FieldStep {
  id: string;
  name: string;
  label: string;
  prompt: string;
  example: string;
}

const REQUIRED_STEPS: FieldStep[] = [
  {
    id: "name",
    name: "Full Name",
    label: "Candidate Name",
    prompt: "Step 1 of 4: Please speak your full name.",
    example: "e.g., Alex Carter",
  },
  {
    id: "targetRole",
    name: "Target Career Role",
    label: "Target Role",
    prompt: "Step 2 of 4: What is your target career or dream job?",
    example: "e.g., Cloud Architect or Data Analyst",
  },
  {
    id: "skills",
    name: "Key Technical or Core Skills",
    label: "Core Skills",
    prompt: "Step 3 of 4: What are two or three of your core skills or technologies?",
    example: "e.g., Python, SQL, and Problem Solving",
  },
  {
    id: "email",
    name: "Contact Email",
    label: "Email Address",
    prompt: "Step 4 of 4: Please speak your email address for career alerts.",
    example: "e.g., alex at gmail dot com",
  },
];

export function BlindAccessibleFieldGuide({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user, setTargetRole, setUserSkills, voiceLanguage } = useApp();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({
    name: user?.name || "",
    targetRole: user?.targetRole || "",
    skills: "",
    email: user?.email || "",
  });

  // Flow states: "asking" -> "listening_input" -> "verifying"
  const [phase, setPhase] = useState<"idle" | "asking" | "listening_input" | "verifying">("idle");
  const [pendingValue, setPendingValue] = useState("");
  const [statusText, setStatusText] = useState("");
  const [isListening, setIsListening] = useState(false);

  const controllerRef = useRef<SpeechRecognitionController | null>(null);
  const currentStep = REQUIRED_STEPS[currentStepIndex];

  const stopCurrentListening = useCallback(() => {
    if (controllerRef.current) {
      try {
        controllerRef.current.stop();
      } catch {}
      controllerRef.current = null;
    }
    setIsListening(false);
  }, []);

  // ── Step 1: Speak the question for current field ─────────────────────────
  const askCurrentFieldQuestion = useCallback(() => {
    if (!currentStep) return;
    stopCurrentListening();
    stopSpeaking();

    setPhase("asking");
    setStatusText(currentStep.prompt);

    speakText(currentStep.prompt, {
      lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
      onEnd: () => {
        setTimeout(() => {
          listenForFieldInput();
        }, 500);
      },
      onError: () => {
        setTimeout(() => {
          listenForFieldInput();
        }, 500);
      },
    });
  }, [currentStep, voiceLanguage, stopCurrentListening]);

  // ── Step 2: Listen for the user's field input ─────────────────────────────
  const listenForFieldInput = useCallback(() => {
    stopCurrentListening();
    setPhase("listening_input");
    setStatusText(`Listening for your ${currentStep.name}... Speak now.`);
    playAccessibleChime("start");

    const controller = startSpeechRecognition({
      lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
      onListeningChange: (active: boolean) => setIsListening(active),
      onTranscript: (transcript: string, isFinal?: boolean) => {
        if (!transcript.trim()) return;

        if (isFinal) {
          stopCurrentListening();
          const cleanAnswer = transcript.trim();
          setPendingValue(cleanAnswer);
          verifyFieldValue(cleanAnswer);
        }
      },
      onError: () => {
        setStatusText("Could not hear clearly. Let's re-try.");
        setTimeout(() => {
          askCurrentFieldQuestion();
        }, 1500);
      },
    });

    controllerRef.current = controller;
  }, [currentStep, voiceLanguage, stopCurrentListening, askCurrentFieldQuestion]);

  // ── Step 3: Spell out every letter + read back word + ask Yes or No ──────
  const verifyFieldValue = useCallback(
    (valueToVerify: string) => {
      stopCurrentListening();
      setPhase("verifying");

      // Spell out every letter phonetically for the blind user
      const spelledLetters = spellOutWord(valueToVerify);
      const verificationPrompt = `You entered: ${spelledLetters}. Word: ${valueToVerify}. Is this correct? Please say Yes or No.`;

      setStatusText(`Verifying: "${valueToVerify}". Please say Yes or No.`);

      speakText(verificationPrompt, {
        lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
        onEnd: () => {
          setTimeout(() => {
            listenForYesNoConfirmation(valueToVerify);
          }, 500);
        },
      });
    },
    [voiceLanguage, stopCurrentListening]
  );

  // ── Step 4: Listen for Yes / No confirmation ──────────────────────────────
  const listenForYesNoConfirmation = useCallback(
    (confirmedCandidateValue: string) => {
      stopCurrentListening();
      setIsListening(true);
      setStatusText("Awaiting confirmation: Say 'Yes' to confirm or 'No' to re-enter.");
      playAccessibleChime("focus");

      const controller = startSpeechRecognition({
        lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
        onListeningChange: (active: boolean) => setIsListening(active),
        onTranscript: (transcript: string, isFinal?: boolean) => {
          if (!transcript.trim()) return;

          const lower = transcript.toLowerCase().trim();

          const isYes =
            lower.includes("yes") ||
            lower.includes("yeah") ||
            lower.includes("correct") ||
            lower.includes("right") ||
            lower.includes("haan") ||
            lower.includes("sahi") ||
            lower.includes("oui") ||
            lower.includes("si") ||
            lower.includes("sure");

          const isNo =
            lower.includes("no") ||
            lower.includes("nope") ||
            lower.includes("wrong") ||
            lower.includes("incorrect") ||
            lower.includes("nahi") ||
            lower.includes("galat") ||
            lower.includes("non");

          if (isYes) {
            stopCurrentListening();
            handleConfirmedValue(confirmedCandidateValue);
          } else if (isNo) {
            stopCurrentListening();
            handleRejectedValue();
          } else if (isFinal) {
            speakText("Please clearly say Yes to confirm or No to try again.", {
              lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
              onEnd: () => {
                setTimeout(() => listenForYesNoConfirmation(confirmedCandidateValue), 500);
              },
            });
          }
        },
      });

      controllerRef.current = controller;
    },
    [voiceLanguage, stopCurrentListening]
  );

  // ── Handle Confirmation: Save and advance ────────────────────────────────
  const handleConfirmedValue = useCallback(
    (val: string) => {
      playAccessibleChime("success");
      setFieldValues((prev) => ({ ...prev, [currentStep.id]: val }));

      // Save to global user state
      if (currentStep.id === "targetRole") {
        setTargetRole(val as RoleId);
      }
      if (currentStep.id === "skills") {
        const parsedSkills = val.split(/[,&]/).map((s) => s.trim()).filter(Boolean);
        setUserSkills(parsedSkills);
      }

      const nextIndex = currentStepIndex + 1;
      if (nextIndex < REQUIRED_STEPS.length) {
        const nextStepPrompt = `Confirmed. ${val} saved. Moving to step ${nextIndex + 1}.`;
        setStatusText(nextStepPrompt);
        speakText(nextStepPrompt, {
          lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
          onEnd: () => {
            setCurrentStepIndex(nextIndex);
          },
        });
      } else {
        const completionMsg = `All required fields verified and saved successfully! Welcome to CareerForge.`;
        setStatusText(completionMsg);
        speakText(completionMsg, {
          lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
          onEnd: () => {
            setTimeout(() => onClose(), 1200);
          },
        });
      }
    },
    [currentStep, currentStepIndex, setTargetRole, setUserSkills, voiceLanguage, onClose]
  );

  // ── Handle Rejection: Re-prompt ───────────────────────────────────────────
  const handleRejectedValue = useCallback(() => {
    playAccessibleChime("clear");
    const retryMsg = `Understood. Let's re-enter your ${currentStep.name}.`;
    setStatusText(retryMsg);
    speakText(retryMsg, {
      lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
      onEnd: () => {
        setTimeout(() => {
          listenForFieldInput();
        }, 500);
      },
    });
  }, [currentStep, voiceLanguage, listenForFieldInput]);

  // Initial trigger when modal opens or step changes
  useEffect(() => {
    if (isOpen) {
      askCurrentFieldQuestion();
    } else {
      stopCurrentListening();
      stopSpeaking();
    }
    return () => {
      stopCurrentListening();
      stopSpeaking();
    };
  }, [isOpen, currentStepIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Blind Accessible Field Form Assistant"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-xl rounded-2xl border-2 border-emerald-500 bg-neutral-900 p-6 text-white shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-xl font-bold">
              🎙️
            </span>
            <div>
              <h2 className="text-xl font-bold text-emerald-400">Blind Accessibility Voice Guide</h2>
              <p className="text-xs text-neutral-400">
                Interactive questions with Yes/No verification & letter-by-letter readback
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice field guide"
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 cursor-pointer"
          >
            Esc / Close
          </button>
        </div>

        {/* Current Step Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-emerald-400">
              Field {currentStepIndex + 1} of {REQUIRED_STEPS.length}: {currentStep.name}
            </span>
            <span className="text-neutral-400">{isListening ? "🔴 Listening to you" : "🔊 Speaking to you"}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-800">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${((currentStepIndex + 1) / REQUIRED_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Live Status Display with high contrast */}
        <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-5 space-y-3">
          <p className="text-xs uppercase tracking-wider text-neutral-400 font-mono">Current Status</p>
          <p className="text-lg font-medium text-neutral-100 leading-relaxed">{statusText}</p>

          {pendingValue && phase === "verifying" && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-3 space-y-1">
              <p className="text-xs text-emerald-300 font-semibold uppercase">Spelled Out For Auditory Check:</p>
              <p className="font-mono text-base text-emerald-200 tracking-wider">
                {spellOutWord(pendingValue)}
              </p>
              <p className="text-sm font-bold text-white mt-1">Say "Yes" to confirm, or "No" to retry.</p>
            </div>
          )}
        </div>

        {/* Action Controls for manual override if needed */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleConfirmedValue(pendingValue || currentStep.example)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer"
            >
              ✓ Yes (Confirm)
            </button>
            <button
              type="button"
              onClick={handleRejectedValue}
              className="rounded-lg bg-red-800 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 cursor-pointer"
            >
              ✗ No (Re-speak)
            </button>
          </div>

          <button
            type="button"
            onClick={askCurrentFieldQuestion}
            className="text-xs text-neutral-400 underline hover:text-white cursor-pointer"
          >
            ↻ Repeat Question
          </button>
        </div>
      </div>
    </div>
  );
}
