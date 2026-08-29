"use client";

import { useEffect, useState, useRef } from "react";
import { useApp } from "@/lib/store";
import {
  startSpeechRecognition,
  SpeechRecognitionController,
  detectTextLanguage,
  speakText,
  stopSpeaking,
} from "@/lib/voice";

export function VoiceModeDetector() {
  const { user, voiceMode, voiceChecked, setVoiceMode, setVoiceLanguage, setVoiceChecked } = useApp();
  const [attempt, setAttempt] = useState<number>(1);
  const [listening, setListening] = useState(false);
  const [detectedText, setDetectedText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only run the 3-check voice detection once per user session
    if (user && !voiceChecked) {
      setModalOpen(true);
      startVoiceCheckCycle(1);
    }

    return () => {
      stopSpeaking();
      recognitionRef.current?.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, voiceChecked]);

  const startVoiceCheckCycle = (currentAttempt: number) => {
    if (currentAttempt > 3) {
      // 3 Attempts completed with no voice -> Default to Text Mode
      setModalOpen(false);
      setVoiceMode(false);
      setVoiceChecked(true);
      return;
    }

    setAttempt(currentAttempt);
    setListening(true);

    try {
      recognitionRef.current = startSpeechRecognition({
        onTranscript: (transcript, isFinal) => {
          if (transcript.trim().length > 0) {
            // VOICE DETECTED!
            setDetectedText(transcript);
            handleVoiceDetected(transcript);
          }
        },
        onListeningChange: (isList) => setListening(isList),
        onError: () => {
          // If silence / error on this attempt, move to next check after brief pause
          scheduleNextAttempt(currentAttempt + 1);
        },
      });

      // Set 4-second listening window per attempt
      timeoutRef.current = setTimeout(() => {
        recognitionRef.current?.stop();
        scheduleNextAttempt(currentAttempt + 1);
      }, 4000);
    } catch {
      scheduleNextAttempt(currentAttempt + 1);
    }
  };

  const scheduleNextAttempt = (nextAttempt: number) => {
    if (nextAttempt <= 3) {
      timeoutRef.current = setTimeout(() => {
        startVoiceCheckCycle(nextAttempt);
      }, 800);
    } else {
      // Finished 3 checks with no voice
      setModalOpen(false);
      setVoiceMode(false);
      setVoiceChecked(true);
    }
  };

  const handleVoiceDetected = (transcript: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    recognitionRef.current?.stop();

    const detectedLang = detectTextLanguage(transcript);
    setVoiceLanguage(detectedLang);
    setVoiceMode(true);
    setVoiceChecked(true);
    setModalOpen(false);

    // Speak welcome guide in detected language
    const welcomeMessages: Record<string, string> = {
      "hi-IN": "वॉयस डिटेक्ट हो गया है। आप अब एआई वॉयस मोड में हैं। मैं आपको हर स्टेप पर गाइड करूंगा।",
      "gu-IN": "તમારો અવાજ ઓળખાઈ ગયો છે. તમે હવે એઆઈ વોઈસ મોડમાં છો. હું તમને દરેક પગલે મદદ કરીશ.",
      "en-IN": "Voice detected! Welcome to CareerForge. You are in AI Voice Assistance Mode. I will help you at every stage.",
      "en-US": "Voice detected! Welcome to CareerForge. You are in AI Voice Assistance Mode. I will help you at every stage.",
    };

    const msg = welcomeMessages[detectedLang] || welcomeMessages["en-IN"];
    speakText(msg, { lang: detectedLang });
  };

  const forceTextMode = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    recognitionRef.current?.stop();
    setModalOpen(false);
    setVoiceMode(false);
    setVoiceChecked(true);
  };

  const forceVoiceMode = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    recognitionRef.current?.stop();
    setModalOpen(false);
    setVoiceMode(true);
    setVoiceChecked(true);
    speakText("AI Voice Assistance Mode activated.", { lang: "en-IN" });
  };

  if (!modalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-indigo-200 bg-white p-6 shadow-2xl text-center">
        {/* Pulsing AI Mic Indicator */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 border-2 border-indigo-400">
          <span className="text-3xl animate-bounce">🎙️</span>
        </div>

        <h3 className="mt-4 text-lg font-bold text-neutral-900">
          AI Voice Detection Check ({attempt}/3)
        </h3>
        <p className="mt-1 text-xs text-neutral-600">
          Say anything or speak in your language to activate <strong>Voice Mode</strong>.
          If no voice is detected, we will stay in <strong>Text Mode</strong>.
        </p>

        {/* Live Audio Waves Animation */}
        <div className="mt-4 flex items-center justify-center gap-1.5 h-6">
          <span className="h-4 w-1 rounded-full bg-indigo-500 animate-pulse" />
          <span className="h-6 w-1 rounded-full bg-indigo-600 animate-pulse delay-75" />
          <span className="h-5 w-1 rounded-full bg-indigo-500 animate-pulse delay-150" />
          <span className="h-3 w-1 rounded-full bg-indigo-400 animate-pulse" />
        </div>

        {detectedText && (
          <p className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 py-1 px-2.5 rounded-lg">
            Heard: &quot;{detectedText}&quot;
          </p>
        )}

        {/* Manual Override Action Buttons */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={forceTextMode}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
          >
            ⌨️ Continue in Text Mode
          </button>
          <button
            type="button"
            onClick={forceVoiceMode}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md cursor-pointer"
          >
            🎙️ Enable Voice Mode
          </button>
        </div>
      </div>
    </div>
  );
}
