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
  setBlindGuideActive,
  isSelfVoiceEcho,
  normalizeSpokenEmail,
} from "@/lib/voice";

interface FieldStep {
  id: string;
  name: string;
  label: string;
  getQuestionText: (lang: string, isFirst?: boolean) => string;
  getConfirmationText: (val: string, lang: string) => string;
  getConfirmedAck: (val: string, lang: string) => string;
}

const REQUIRED_STEPS: FieldStep[] = [
  {
    id: "name",
    name: "Full Name",
    label: "Candidate Name",
    getQuestionText: (lang, isFirst) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isFirst) {
        if (isGu) {
          return "કરિયરફોર્જ વૉઇસ ગાઇડમાં સ્વાગત છે. હું તમને બોલીને ચાર પ્રશ્નો પૂછીશ જેથી તમે સ્ક્રીન જોયા વગર પ્રોફાઇલ બનાવી શકો. જ્યારે અવાજ સંભળાય, ત્યારે તમારો જવાબ બોલો. પહેલો પ્રશ્ન: તમારું પૂરું નામ શું છે?";
        }
        if (isHi) {
          return "करियरफोर्ज वॉइस गाइड में आपका स्वागत है। मैं आपसे बोलकर चार सवाल पूछूँगा ताकि आप बिना स्क्रीन देखे अपनी प्रोफ़ाइल बना सकें। जब घंटी बजे, तब अपना जवाब बोलें। पहला सवाल: आपका पूरा नाम क्या है?";
        }
        return "Welcome to the CareerForge Voice Guide. I will ask you four quick questions out loud so you can complete your profile without needing the screen. When you hear the chime, speak your answer. Question 1: What is your full name?";
      }
      if (isGu) return "પહેલો પ્રશ્ન: કૃપા કરીને તમારું પૂરું નામ બોલો.";
      if (isHi) return "पहला सवाल: कृपया अपना पूरा नाम बोलें।";
      return "Question 1: Please speak your full name.";
    },
    getConfirmationText: (val, lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return `તમે બોલ્યા: ${val}. શું આ સાચું છે? હા અથવા ના બોલો.`;
      if (isHi) return `आपने कहा: ${val}। क्या यह सही है? कृपया हाँ या ना बोलें।`;
      return `Got it. You said: ${val}. Is that correct? Please say Yes to confirm, or No to re-speak.`;
    },
    getConfirmedAck: (val, lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return `નામ ${val} સાચવવામાં આવ્યું.`;
      if (isHi) return `नाम ${val} सहेज लिया गया।`;
      return `Name ${val} confirmed and saved.`;
    },
  },
  {
    id: "targetRole",
    name: "Target Career Role",
    label: "Target Role",
    getQuestionText: (lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return "બીજો પ્રશ્ન: તમારો લક્ષિત જોબ રોલ કયો છે? જેમ કે ફ્રન્ટએન્ડ ડેવલપર, ડેટા એનાલિસ્ટ કે ક્લાઉડ એન્જિનિયર.";
      if (isHi) return "दूसरा सवाल: आपका लक्षित जॉब रोल क्या है? जैसे कि फ्रंटएंड डेवलपर, डेटा एनालिस्ट या क्लाउड इंजीनियर।";
      return "Question 2: What is your target career or dream job role? For example, Software Engineer, Cloud Architect, or Product Manager.";
    },
    getConfirmationText: (val, lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return `તમારો લક્ષિત રોલ: ${val}. શું આ સાચું છે? હા અથવા ના બોલો.`;
      if (isHi) return `आपका लक्षित रोल: ${val}। क्या यह सही है? हाँ या ना बोलें।`;
      return `I heard your target role is: ${val}. Is that correct? Say Yes or No.`;
    },
    getConfirmedAck: (val, lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return `રોલ ${val} સાચવવામાં આવ્યો.`;
      if (isHi) return `रोल ${val} सहेज लिया गया।`;
      return `Target role ${val} confirmed and saved.`;
    },
  },
  {
    id: "skills",
    name: "Key Technical or Core Skills",
    label: "Core Skills",
    getQuestionText: (lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return "ત્રીજો પ્રશ્ન: તમારી મુખ્ય બે કે ત્રણ સ્કિલ અથવા ટેકનોલોજી કઈ છે? જેમ કે રીએક્ટ, પાયથન કે એસક્યુએલ.";
      if (isHi) return "तीसरा सवाल: आपके मुख्य दो या तीन कौशल या तकनीकें कौन सी हैं? जैसे कि रिएक्ट, पायथन या एसक्यूएल।";
      return "Question 3: What are two or three of your core technical skills or technologies? For example, React, Python, or SQL.";
    },
    getConfirmationText: (val, lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return `તમારી સ્કિલ્સ: ${val}. શું આ સાચું છે? હા અથવા ના બોલો.`;
      if (isHi) return `आपके कौशल: ${val}। क्या यह सही है? हाँ या ना बोलें।`;
      return `You listed your skills as: ${val}. Is that correct? Say Yes or No.`;
    },
    getConfirmedAck: (val, lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return `સ્કિલ્સ સાચવવામાં આવી.`;
      if (isHi) return `कौशल सहेज लिए गए।`;
      return `Skills saved.`;
    },
  },
  {
    id: "email",
    name: "Contact Email",
    label: "Email Address",
    getQuestionText: (lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return "ચોથો અને છેલ્લો પ્રશ્ન: જોબ એલર્ટ મેળવવા માટે તમારું ઈમેઈલ એડ્રેસ કયું છે? જેમ કે એલેક્સ એટ જીમેલ ડોટ કોમ.";
      if (isHi) return "चौथा और अंतिम सवाल: जॉब अलर्ट और अपडेट पाने के लिए आपका ईमेल पता क्या है? जैसे कि राहुल एट जीमेल डॉट कॉम।";
      return "Final question: What is your contact email address for job alerts and opportunities? For example, alex at gmail dot com.";
    },
    getConfirmationText: (val, lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return `તમારું ઈમેઈલ એડ્રેસ: ${val}. શું આ સાચું છે? હા અથવા ના બોલો.`;
      if (isHi) return `आपका ईमेल पता: ${val}। क्या यह सही है? कृपया हाँ या ना बोलें।`;
      return `I recorded your email as: ${val}. Is that correct? Say Yes or No.`;
    },
    getConfirmedAck: (val, lang) => {
      const isGu = lang.startsWith("gu");
      const isHi = lang.startsWith("hi");
      if (isGu) return `ઈમેઈલ ${val} સાચવવામાં આવ્યું.`;
      if (isHi) return `ईमेल ${val} सहेज लिया गया।`;
      return `Email ${val} confirmed and saved.`;
    },
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

  // Flow states: "asking" -> "listening_input" -> "verifying" -> "listening_yes_no"
  const [phase, setPhase] = useState<"idle" | "asking" | "listening_input" | "verifying" | "listening_yes_no">("idle");
  const [pendingValue, setPendingValue] = useState("");
  const [spokenPrompt, setSpokenPrompt] = useState("");
  const [statusText, setStatusText] = useState("");
  const [isListening, setIsListening] = useState(false);

  const controllerRef = useRef<SpeechRecognitionController | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  // ── Step 1: Speak the question out loud ──────────────────────────────────
  const askCurrentFieldQuestion = useCallback(
    (isFirst = false) => {
      if (!currentStep) return;
      stopCurrentListening();
      stopSpeaking();
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);

      const lang = voiceLanguage !== "auto" ? voiceLanguage : "en-US";
      const questionText = currentStep.getQuestionText(lang, isFirst);

      setPhase("asking");
      setSpokenPrompt(questionText);
      setStatusText(questionText);

      speakText(questionText, {
        lang,
        onEnd: () => {
          // Acoustic echo cooldown (800ms) to ensure speaker room reverb clears completely
          cooldownTimerRef.current = setTimeout(() => {
            // Play ready chime
            playAccessibleChime("start");
            setTimeout(() => {
              listenForFieldInput();
            }, 300);
          }, 800);
        },
        onError: () => {
          cooldownTimerRef.current = setTimeout(() => {
            listenForFieldInput();
          }, 800);
        },
      });
    },
    [currentStep, voiceLanguage, stopCurrentListening]
  );

  // ── Step 2: Listen for user's voice answer (Mic is ONLY open here!) ───────
  const listenForFieldInput = useCallback(() => {
    stopCurrentListening();
    setPhase("listening_input");
    setStatusText(`Listening for your ${currentStep.name}... Speak now.`);

    const lang = voiceLanguage !== "auto" ? voiceLanguage : "en-US";

    const controller = startSpeechRecognition(
      {
        lang,
        isBlindGuide: true,
        continuous: false,
        onListeningChange: (active: boolean) => setIsListening(active),
        onTranscript: (transcript: string, isFinal?: boolean) => {
          if (!transcript.trim()) return;

          // Suppress any stray acoustic feedback from the assistant's own voice
          if (isSelfVoiceEcho(transcript)) {
            console.warn("[Blind Guide] Blocked self-voice echo:", transcript);
            return;
          }

          if (isFinal) {
            stopCurrentListening();
            let cleanAnswer = transcript.trim();
            if (currentStep.id === "email") {
              cleanAnswer = normalizeSpokenEmail(cleanAnswer) || cleanAnswer;
            }
            setPendingValue(cleanAnswer);
            verifyFieldValue(cleanAnswer);
          }
        },
        onError: (err) => {
          console.warn("[Blind Guide] Error hearing input:", err);
          setStatusText("Could not hear clearly. Let's re-try.");
          setTimeout(() => {
            promptRetry();
          }, 1200);
        },
      },
      { lang, continuous: false, isBlindGuide: true }
    );

    controllerRef.current = controller;
  }, [currentStep, voiceLanguage, stopCurrentListening]);

  // ── Step 3: Verbally ask confirmation ("I heard Alex Carter. Is this correct?") ──
  const verifyFieldValue = useCallback(
    (valueToVerify: string) => {
      stopCurrentListening();
      stopSpeaking();
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);

      setPhase("verifying");
      const lang = voiceLanguage !== "auto" ? voiceLanguage : "en-US";
      const confirmationText = currentStep.getConfirmationText(valueToVerify, lang);

      setStatusText(confirmationText);
      setSpokenPrompt(confirmationText);

      speakText(confirmationText, {
        lang,
        onEnd: () => {
          // Acoustic echo cooldown (800ms) before opening mic for Yes/No
          cooldownTimerRef.current = setTimeout(() => {
            playAccessibleChime("focus");
            setTimeout(() => {
              listenForYesNoConfirmation(valueToVerify);
            }, 300);
          }, 800);
        },
        onError: () => {
          cooldownTimerRef.current = setTimeout(() => {
            listenForYesNoConfirmation(valueToVerify);
          }, 800);
        },
      });
    },
    [currentStep, voiceLanguage, stopCurrentListening]
  );

  // ── Step 4: Listen for Yes or No ─────────────────────────────────────────
  const listenForYesNoConfirmation = useCallback(
    (confirmedCandidateValue: string) => {
      stopCurrentListening();
      setPhase("listening_yes_no");
      setStatusText("Awaiting confirmation: Say 'Yes' to confirm or 'No' to re-speak.");

      const lang = voiceLanguage !== "auto" ? voiceLanguage : "en-US";

      const controller = startSpeechRecognition(
        {
          lang,
          isBlindGuide: true,
          continuous: false,
          onListeningChange: (active: boolean) => setIsListening(active),
          onTranscript: (transcript: string, isFinal?: boolean) => {
            if (!transcript.trim()) return;

            if (isSelfVoiceEcho(transcript)) {
              console.warn("[Blind Guide] Blocked self-voice echo in Yes/No:", transcript);
              return;
            }

            const lower = transcript.toLowerCase().trim();

            const isYes =
              lower.includes("yes") ||
              lower.includes("yeah") ||
              lower.includes("yep") ||
              lower.includes("correct") ||
              lower.includes("right") ||
              lower.includes("haan") ||
              lower.includes("ha") ||
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
              lower.includes("na") ||
              lower.includes("galat") ||
              lower.includes("non");

            if (isYes) {
              stopCurrentListening();
              handleConfirmedValue(confirmedCandidateValue);
            } else if (isNo) {
              stopCurrentListening();
              promptRetry();
            } else if (isFinal) {
              speakText("Please clearly say Yes to confirm or No to try again.", {
                lang,
                onEnd: () => {
                  cooldownTimerRef.current = setTimeout(() => {
                    listenForYesNoConfirmation(confirmedCandidateValue);
                  }, 800);
                },
              });
            }
          },
        },
        { lang, continuous: false, isBlindGuide: true }
      );

      controllerRef.current = controller;
    },
    [voiceLanguage, stopCurrentListening]
  );

  // ── Step 5: Save confirmed value & verbally transition to next question ──
  const handleConfirmedValue = useCallback(
    (val: string) => {
      playAccessibleChime("success");
      setFieldValues((prev) => ({ ...prev, [currentStep.id]: val }));

      // Save to global user profile state
      if (currentStep.id === "targetRole") {
        setTargetRole(val as RoleId);
      }
      if (currentStep.id === "skills") {
        const parsedSkills = val.split(/[,&]/).map((s) => s.trim()).filter(Boolean);
        setUserSkills(parsedSkills);
      }

      const lang = voiceLanguage !== "auto" ? voiceLanguage : "en-US";
      const ackText = currentStep.getConfirmedAck(val, lang);

      const nextIndex = currentStepIndex + 1;
      if (nextIndex < REQUIRED_STEPS.length) {
        setStatusText(ackText);
        setSpokenPrompt(ackText);
        speakText(ackText, {
          lang,
          onEnd: () => {
            setCurrentStepIndex(nextIndex);
          },
        });
      } else {
        const isGu = lang.startsWith("gu");
        const isHi = lang.startsWith("hi");
        const completionMsg = isGu
          ? "અભિનંદન! તમારી બધી જ વિગતો ચકાસીને સાચવવામાં આવી છે. કરિયરફોર્જમાં તમારું સ્વાગત છે!"
          : isHi
          ? "बधाई हो! आपकी सभी जानकारियाँ सत्यापित कर सहेज ली गई हैं। करियरफोर्ज में आपका स्वागत है!"
          : "Congratulations! All your profile details have been verified and saved. Welcome to CareerForge!";

        setStatusText(completionMsg);
        setSpokenPrompt(completionMsg);
        speakText(completionMsg, {
          lang,
          onEnd: () => {
            setTimeout(() => {
              onClose();
            }, 1000);
          },
        });
      }
    },
    [currentStep, currentStepIndex, setTargetRole, setUserSkills, voiceLanguage, onClose]
  );

  // ── Step 6: Handle rejection / retry verbally ─────────────────────────────
  const promptRetry = useCallback(() => {
    playAccessibleChime("clear");
    const lang = voiceLanguage !== "auto" ? voiceLanguage : "en-US";
    const isGu = lang.startsWith("gu");
    const isHi = lang.startsWith("hi");

    const retryMsg = isGu
      ? `કોઈ વાંધો નહીં. ચાલો ફરીથી ${currentStep.name} બોલો.`
      : isHi
      ? `कोई बात नहीं। चलिए फिर से अपना ${currentStep.name} बोलें।`
      : `No problem. Let's try again. Please speak your ${currentStep.name} after the chime.`;

    setStatusText(retryMsg);
    setSpokenPrompt(retryMsg);
    speakText(retryMsg, {
      lang,
      onEnd: () => {
        cooldownTimerRef.current = setTimeout(() => {
          playAccessibleChime("start");
          setTimeout(() => {
            listenForFieldInput();
          }, 300);
        }, 800);
      },
    });
  }, [currentStep, voiceLanguage, listenForFieldInput]);

  // Initial trigger when modal opens or step changes
  useEffect(() => {
    if (isOpen) {
      setBlindGuideActive(true);
      setCurrentStepIndex(0);
      setPendingValue("");
      const timer = setTimeout(() => {
        askCurrentFieldQuestion(true);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setBlindGuideActive(false);
      stopCurrentListening();
      stopSpeaking();
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && currentStepIndex > 0) {
      askCurrentFieldQuestion(false);
    }
  }, [currentStepIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setBlindGuideActive(false);
      stopCurrentListening();
      stopSpeaking();
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const isAssistantSpeaking = phase === "asking" || phase === "verifying";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Blind Accessibility Conversational Voice Guide"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg p-4"
    >
      <div className="w-full max-w-2xl rounded-3xl border-2 border-emerald-500 bg-neutral-950 p-6 sm:p-8 text-white shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Accessible Header with Live Auditory State */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-bold transition-all shadow-md ${
              isAssistantSpeaking
                ? "bg-emerald-600 text-white animate-pulse"
                : isListening
                ? "bg-rose-600 text-white shadow-rose-900/50 shadow-lg"
                : "bg-neutral-800 text-neutral-400"
            }`}>
              {isAssistantSpeaking ? "🔊" : isListening ? "🎙️" : "🦯"}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-emerald-400">
                Blind Accessibility Voice Guide
              </h2>
              <p className="text-xs text-neutral-400">
                100% Conversational Voice Interviewer · Screen-Free Profile Builder
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice field guide"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white cursor-pointer transition-colors"
          >
            Esc / Close
          </button>
        </div>

        {/* Dynamic Voice State Indicator Banner */}
        <div
          role="status"
          aria-live="assertive"
          className={`flex items-center justify-between rounded-2xl p-4 border transition-all ${
            isAssistantSpeaking
              ? "bg-emerald-950/70 border-emerald-500/80 text-emerald-300"
              : isListening
              ? "bg-rose-950/70 border-rose-500/80 text-rose-300 shadow-md animate-pulse"
              : "bg-neutral-900 border-neutral-800 text-neutral-400"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${
              isAssistantSpeaking
                ? "bg-emerald-400 animate-ping"
                : isListening
                ? "bg-rose-500 animate-ping"
                : "bg-neutral-600"
            }`} />
            <span className="text-sm font-bold tracking-wide">
              {isAssistantSpeaking
                ? "🔊 AI Assistant is asking you a question out loud..."
                : isListening
                ? "🎙️ Listening to your voice now... Speak clearly!"
                : "⏳ Processing..."}
            </span>
          </div>

          <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-black/40 text-neutral-300 border border-white/10">
            {isAssistantSpeaking ? "Mic Paused (No Echo)" : "Your Voice Active"}
          </span>
        </div>

        {/* Step Progress Visual & Auditory Tracker */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm font-semibold text-neutral-300">
            <span className="text-emerald-400 font-bold">
              Question {currentStepIndex + 1} of {REQUIRED_STEPS.length}: {currentStep.name}
            </span>
            <span>
              {Math.round(((currentStepIndex + 1) / REQUIRED_STEPS.length) * 100)}% Complete
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              style={{ width: `${((currentStepIndex + 1) / REQUIRED_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question & Spoken Dialogue Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 sm:p-6 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-emerald-500 font-mono font-bold">
            Spoken by AI Assistant:
          </p>
          <p className="text-lg sm:text-xl font-medium text-neutral-100 leading-relaxed">
            {statusText}
          </p>

          {pendingValue && phase === "listening_yes_no" && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 space-y-1">
              <p className="text-xs text-emerald-400 font-semibold uppercase">Voice Captured:</p>
              <p className="text-lg font-bold text-white">"{pendingValue}"</p>
              <p className="text-xs text-neutral-300 pt-1">
                Say <span className="text-emerald-400 font-bold">"Yes"</span> to confirm, or <span className="text-rose-400 font-bold">"No"</span> to re-speak.
              </p>
            </div>
          )}
        </div>

        {/* Accessible Voice Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => askCurrentFieldQuestion(false)}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white cursor-pointer transition-colors"
              title="Repeat Spoken Question"
            >
              <span>🔊</span>
              <span>Repeat Question</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {phase === "listening_yes_no" && (
              <>
                <button
                  type="button"
                  onClick={() => handleConfirmedValue(pendingValue)}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-500 cursor-pointer transition-colors shadow-md"
                >
                  ✓ Yes (Confirm)
                </button>
                <button
                  type="button"
                  onClick={promptRetry}
                  className="rounded-xl bg-rose-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-rose-700 cursor-pointer transition-colors shadow-md"
                >
                  ✗ No (Re-speak)
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
