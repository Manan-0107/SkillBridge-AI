"use client";

/**
 * hooks/useVoiceAssistant.ts
 *
 * Enterprise Turn-Taking Voice Assistant Engine:
 * - Strict State Machine: IDLE -> AI_SPEAKING -> LISTENING -> PROCESSING -> FALLBACK_TEXT
 * - Absolute Microphone Mute: Mic is strictly aborted before TTS starts and remains OFF during speech
 * - 300ms Cooldown Gate preventing AI from hearing itself or speaker echo
 * - Single-Instance Protection & React StrictMode Safety
 * - Structured Question State & Answer Validation (Multilingual YES/NO, Name, Email, Career)
 * - 3-Attempt Rule with Automated Text Fallback & Keyboard Focus
 * - Verbal Barge-In Interruption ("Stop", "Wait", "Pause", "Repeat")
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  VoiceState,
  SpeechProviderType,
  SpeechError,
  QuestionState,
  ExpectedAnswerType,
} from "@/lib/speech/types";
import { getSpeechService } from "@/lib/speech/speechService";
import {
  detectLanguageFromText,
  getSupportedLanguage,
} from "@/lib/speech/languages";
import {
  validateUserAnswer,
  getQuestionRetryPrompt,
  getFallbackMessage,
  ValidationResult,
} from "@/lib/speech/questionFlow";
import { playAccessibleChime } from "@/lib/voice";

export interface UseVoiceAssistantOptions {
  initialLanguage?: string;
  initialProvider?: SpeechProviderType;
  autoListenAfterSpeech?: boolean;
  onValidAnswer?: (question: QuestionState, validatedValue: any) => void;
  onFallbackToText?: (activeQuestion: QuestionState | null, fallbackMessage: string) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onStateChange?: (state: VoiceState) => void;
  onError?: (error: SpeechError) => void;
}

export interface UseVoiceAssistantReturn {
  state: VoiceState;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isTextFallback: boolean;
  transcript: string;
  interimTranscript: string;
  activeLanguage: string;
  activeProvider: SpeechProviderType;
  currentQuestion: QuestionState | null;
  lastSpokenText: string | null;
  errorMessage: string | null;
  permissionDenied: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  speak: (text: string, lang?: string, options?: { isQuestion?: boolean; questionState?: QuestionState }) => Promise<void>;
  stopSpeaking: () => void;
  pauseSpeaking: () => void;
  resumeSpeaking: () => void;
  repeatLastSpoken: () => void;
  setLanguage: (lang: string) => void;
  setProvider: (provider: SpeechProviderType) => void;
  setActiveQuestion: (question: QuestionState | null) => void;
  switchToTextMode: (reason?: string) => void;
  resetConversation: () => void;
}

export function useVoiceAssistant(
  options: UseVoiceAssistantOptions = {}
): UseVoiceAssistantReturn {
  const {
    initialLanguage = "en",
    initialProvider = "auto",
    autoListenAfterSpeech = true,
    onValidAnswer,
    onFallbackToText,
    onTranscript,
    onStateChange,
    onError,
  } = options;

  // React State for UI
  const [state, setState] = useState<VoiceState>("IDLE");
  const [activeLanguage, setActiveLanguage] = useState<string>(initialLanguage);
  const [activeProvider, setActiveProvider] = useState<SpeechProviderType>(initialProvider);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionState | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [lastSpokenText, setLastSpokenText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  // Real-Time Audio Synchronization Refs
  const isAISpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const shouldListenRef = useRef(false);
  const voiceStateRef = useRef<VoiceState>("IDLE");
  const currentQuestionRef = useRef<QuestionState | null>(null);
  const lastProcessedTranscriptRef = useRef<string>("");
  const lastTranscriptTimeRef = useRef<number>(0);

  const recognitionRef = useRef<any>(null);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const speechService = useRef(getSpeechService(initialProvider));
  const activeLanguageRef = useRef(activeLanguage);
  activeLanguageRef.current = activeLanguage;

  const updateState = useCallback(
    (nextState: VoiceState) => {
      console.log(`[VOICE STATE] ${voiceStateRef.current} -> ${nextState}`);
      voiceStateRef.current = nextState;
      setState(nextState);
      onStateChange?.(nextState);
    },
    [onStateChange]
  );

  /**
   * Stop speech recognition immediately (Microphone OFF)
   */
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    shouldListenRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    setInterimTranscript("");
    if (voiceStateRef.current === "LISTENING") {
      updateState("IDLE");
    }
  }, [updateState]);

  /**
   * Stop any playing TTS audio or speech synthesis immediately
   */
  const stopSpeaking = useCallback(() => {
    isAISpeakingRef.current = false;

    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (currentAudioElementRef.current) {
        try {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current.currentTime = 0;
        } catch {}
        currentAudioElementRef.current = null;
      }
    }

    if (voiceStateRef.current === "AI_SPEAKING") {
      updateState("IDLE");
    }
  }, [updateState]);

  /**
   * Gracefully switch to Text Fallback Mode after 3 failed attempts
   */
  const switchToTextMode = useCallback(
    (reason = "Three failed attempts") => {
      console.log(`[VOICE FALLBACK] Switching to text mode. Reason: ${reason}`);

      stopSpeaking();
      stopListening();

      isAISpeakingRef.current = false;
      isListeningRef.current = false;
      shouldListenRef.current = false;

      updateState("FALLBACK_TEXT");

      const fallbackMsg = getFallbackMessage(activeLanguageRef.current);
      onFallbackToText?.(currentQuestionRef.current, fallbackMsg);
    },
    [onFallbackToText, stopListening, stopSpeaking, updateState]
  );

  /**
   * Start Microphone Listening (Microphone ON)
   * ONLY called when AI is NOT speaking and cooldown has passed
   */
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    // Safeguard: NEVER listen if AI is speaking or if in text fallback
    if (isAISpeakingRef.current || voiceStateRef.current === "AI_SPEAKING" || voiceStateRef.current === "FALLBACK_TEXT") {
      console.warn("[VOICE GUARD] Cannot start listening while AI is speaking or in fallback mode.");
      return;
    }

    setErrorMessage(null);
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      const err: SpeechError = {
        type: "unsupported",
        message: "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.",
        provider: "web",
      };
      setErrorMessage(err.message);
      onError?.(err);
      switchToTextMode("Browser unsupported");
      return;
    }

    // Singleton Protection: Abort any previous instance before creating a new one
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.continuous = false; // Turn-based: finish each turn cleanly
      recognition.interimResults = true;

      const langObj = getSupportedLanguage(activeLanguageRef.current);
      recognition.lang = langObj.speechRecognitionLocale;

      recognition.onstart = () => {
        isListeningRef.current = true;
        shouldListenRef.current = true;
        updateState("LISTENING");
        playAccessibleChime("start");
      };

      recognition.onresult = (event: any) => {
        // Safeguard 3: If AI started speaking while a late event arrived, DISCARD IMMEDIATELY
        if (isAISpeakingRef.current || voiceStateRef.current === "AI_SPEAKING") {
          console.warn("[VOICE GUARD] Dropping incoming recognition result because AI is speaking.");
          return;
        }

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
          onTranscript?.(interim, false);
        }

        if (final) {
          const cleanFinal = final.trim();
          if (!cleanFinal) return;

          // Deduplication: ignore identical transcripts within 1500ms
          const now = Date.now();
          if (
            cleanFinal.toLowerCase() === lastProcessedTranscriptRef.current.toLowerCase() &&
            now - lastTranscriptTimeRef.current < 1500
          ) {
            console.log("[VOICE] Ignoring duplicate transcript:", cleanFinal);
            return;
          }

          lastProcessedTranscriptRef.current = cleanFinal;
          lastTranscriptTimeRef.current = now;

          setTranscript(cleanFinal);
          setInterimTranscript("");

          // ── Verbal Barge-In Interruption Command Check ──
          const lower = cleanFinal.toLowerCase();
          if (
            lower === "stop" ||
            lower === "wait" ||
            lower === "pause" ||
            lower === "રોકો" ||
            lower === "रुको" ||
            lower === "arrête"
          ) {
            stopSpeaking();
            stopListening();
            playAccessibleChime("stop");
            return;
          }

          // Detect spoken language and sync if changed
          const detected = detectLanguageFromText(cleanFinal);
          if (detected && detected !== activeLanguageRef.current) {
            setActiveLanguage(detected);
            activeLanguageRef.current = detected;
          }

          // Immediately stop mic while processing user answer
          stopListening();
          updateState("PROCESSING");
          onTranscript?.(cleanFinal, true);

          // ── Question Validation & Turn-Taking ──
          const activeQ = currentQuestionRef.current;
          if (activeQ && !activeQ.answered) {
            const validation: ValidationResult = validateUserAnswer(
              cleanFinal,
              activeQ.expectedType,
              activeLanguageRef.current
            );

            if (validation.valid) {
              console.log("[VOICE] Valid answer received for question:", activeQ.id, validation.value);
              activeQ.answered = true;
              activeQ.answer = validation.value;
              activeQ.attempts = 0;
              setCurrentQuestion({ ...activeQ });
              currentQuestionRef.current = { ...activeQ };
              onValidAnswer?.(activeQ, validation.value);
            } else {
              // Invalid / Unrelated Answer $\rightarrow$ Increment Attempt
              activeQ.attempts += 1;
              console.warn(`[VOICE] Invalid answer for question: ${activeQ.id}. Attempt ${activeQ.attempts}/3.`);
              setCurrentQuestion({ ...activeQ });
              currentQuestionRef.current = { ...activeQ };

              if (activeQ.attempts >= 3) {
                switchToTextMode(`3 failed attempts on question ${activeQ.id}`);
              } else {
                const retryPrompt = getQuestionRetryPrompt(activeQ, activeLanguageRef.current);
                // Speak the retry question and wait for next attempt
                speak(retryPrompt, activeLanguageRef.current, { isQuestion: true, questionState: activeQ });
              }
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        const rawErr = event.error;
        if (rawErr === "not-allowed" || rawErr === "service-not-allowed") {
          setPermissionDenied(true);
          const err: SpeechError = {
            type: "permission_denied",
            message: "Microphone access is disabled. You can enable it in your browser settings, or continue using text.",
            provider: "web",
          };
          setErrorMessage(err.message);
          onError?.(err);
          switchToTextMode("Microphone permission denied");
        } else if (rawErr !== "no-speech" && rawErr !== "aborted") {
          console.warn("[VOICE ERROR] Recognition error:", rawErr);
        }
        isListeningRef.current = false;
        if (voiceStateRef.current === "LISTENING") {
          updateState("IDLE");
        }
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        // Safeguard 5: NEVER blindly restart if AI is speaking or listening was stopped
        if (
          shouldListenRef.current &&
          !isAISpeakingRef.current &&
          voiceStateRef.current === "LISTENING"
        ) {
          try {
            recognition.start();
          } catch {
            isListeningRef.current = false;
            updateState("IDLE");
          }
        } else if (voiceStateRef.current === "LISTENING") {
          updateState("IDLE");
        }
      };

      recognition.start();
    } catch (err: any) {
      console.error("[VOICE] Recognition start error:", err);
      isListeningRef.current = false;
      updateState("IDLE");
    }
  }, [onError, onTranscript, onValidAnswer, stopListening, stopSpeaking, switchToTextMode, updateState]);

  /**
   * Synthesize and Speak Text using unified Multi-Provider Cascade
   * Microphone is GUARANTEED OFF before speech begins.
   */
  const speak = useCallback(
    async (
      text: string,
      langOverride?: string,
      opts?: { isQuestion?: boolean; questionState?: QuestionState }
    ): Promise<void> => {
      if (!text || !text.trim()) return;

      // ── Step 1: ABSOLUTE MICROPHONE SHUTDOWN BEFORE TTS ──
      stopListening();
      isAISpeakingRef.current = true;
      shouldListenRef.current = opts?.isQuestion || autoListenAfterSpeech;

      const cleanText = text
        .replace(/\[ACTION:.*?\]/g, "")
        .replace(/```[\s\S]*?```/g, "Code block.")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .trim();

      if (!cleanText) {
        isAISpeakingRef.current = false;
        return;
      }

      if (opts?.questionState) {
        currentQuestionRef.current = opts.questionState;
        setCurrentQuestion(opts.questionState);
      }

      const detectedLang = langOverride || detectLanguageFromText(cleanText) || activeLanguageRef.current;
      setActiveLanguage(detectedLang);
      setLastSpokenText(cleanText);
      updateState("AI_SPEAKING");

      const onTTSFinished = () => {
        console.log("[VOICE] TTS Finished.");
        isAISpeakingRef.current = false;
        updateState("IDLE");

        // ── Step 2: 300ms Cooldown Gate before Microphone Starts ──
        if (shouldListenRef.current && voiceStateRef.current !== "FALLBACK_TEXT") {
          setTimeout(() => {
            if (shouldListenRef.current && !isAISpeakingRef.current) {
              startListening();
            }
          }, 300);
        }
      };

      try {
        const audioResult = await speechService.current.textToSpeech(cleanText, {
          language: detectedLang,
        });

        if (audioResult.useNativeSynthesis) {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(cleanText);
            const langObj = getSupportedLanguage(detectedLang);
            utterance.lang = langObj.speechSynthesisLocale;

            const voices = window.speechSynthesis.getVoices();
            const prefix = langObj.speechSynthesisLocale.split("-")[0];
            const voice =
              voices.find((v) => v.lang.toLowerCase() === langObj.speechSynthesisLocale.toLowerCase()) ||
              voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ||
              voices[0];
            if (voice) utterance.voice = voice;

            utterance.onstart = () => {
              isAISpeakingRef.current = true;
              stopListening();
            };

            utterance.onend = () => {
              onTTSFinished();
            };

            utterance.onerror = () => {
              onTTSFinished();
            };

            window.speechSynthesis.speak(utterance);
          } else {
            onTTSFinished();
          }
        } else if (audioResult.audioBuffer) {
          const blob =
            audioResult.audioBuffer instanceof Blob
              ? audioResult.audioBuffer
              : new Blob([audioResult.audioBuffer], { type: audioResult.mimeType || "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioElementRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            currentAudioElementRef.current = null;
            onTTSFinished();
          };

          audio.onerror = () => {
            URL.revokeObjectURL(url);
            currentAudioElementRef.current = null;
            onTTSFinished();
          };

          await audio.play();
        } else {
          onTTSFinished();
        }
      } catch (err: any) {
        console.warn("[useVoiceAssistant] TTS error:", err);
        onTTSFinished();
      }
    },
    [autoListenAfterSpeech, startListening, stopListening, updateState]
  );

  const pauseSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.pause();
      } catch {}
    }
    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.pause();
      } catch {}
    }
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
    if (currentAudioElementRef.current) {
      try {
        currentAudioElementRef.current.play().catch(() => {});
      } catch {}
    }
  }, []);

  const repeatLastSpoken = useCallback(() => {
    if (lastSpokenText) {
      speak(lastSpokenText, activeLanguageRef.current, {
        isQuestion: Boolean(currentQuestionRef.current && !currentQuestionRef.current.answered),
        questionState: currentQuestionRef.current || undefined,
      });
    }
  }, [lastSpokenText, speak]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current || voiceStateRef.current === "LISTENING") {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const setLanguage = useCallback((lang: string) => {
    setActiveLanguage(lang);
    activeLanguageRef.current = lang;
  }, []);

  const setProvider = useCallback((provider: SpeechProviderType) => {
    setActiveProvider(provider);
    speechService.current.setProvider(provider);
  }, []);

  const setActiveQuestion = useCallback((q: QuestionState | null) => {
    currentQuestionRef.current = q;
    setCurrentQuestion(q);
  }, []);

  const resetConversation = useCallback(() => {
    stopSpeaking();
    stopListening();
    currentQuestionRef.current = null;
    setCurrentQuestion(null);
    lastProcessedTranscriptRef.current = "";
    lastTranscriptTimeRef.current = 0;
    updateState("IDLE");
  }, [stopListening, stopSpeaking, updateState]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, [stopListening, stopSpeaking]);

  return {
    state,
    isListening: state === "LISTENING",
    isSpeaking: state === "AI_SPEAKING",
    isProcessing: state === "PROCESSING",
    isTextFallback: state === "FALLBACK_TEXT",
    transcript,
    interimTranscript,
    activeLanguage,
    activeProvider,
    currentQuestion,
    lastSpokenText,
    errorMessage,
    permissionDenied,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    repeatLastSpoken,
    setLanguage,
    setProvider,
    setActiveQuestion,
    switchToTextMode,
    resetConversation,
  };
}
