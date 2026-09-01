"use client";

/**
 * hooks/useVoiceAssistant.ts
 *
 * Universal Voice Assistant Hook for CareerForge:
 * - State Machine: IDLE -> LISTENING -> PROCESSING -> AI_THINKING -> SPEAKING -> IDLE
 * - Multi-Provider Auto Selection (Web Speech API -> Azure AI Speech -> Google Cloud Speech)
 * - True Multilingual Speech Recognition & Synthesis (English, Hindi, Gujarati, French, Spanish, etc.)
 * - Instant Barge-In & Verbal Control Interruption ("Stop", "Wait", "Pause", "Repeat", "Continue")
 * - Real-Time Captions & Transcript Synchronization
 * - Permission Diagnostics & Accessibility Recovery
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  VoiceState,
  SpeechProviderType,
  SpeechError,
  SpeechErrorType,
  SupportedLanguage,
} from "@/lib/speech/types";
import { getSpeechService } from "@/lib/speech/speechService";
import {
  detectLanguageFromText,
  getSupportedLanguage,
  SUPPORTED_LANGUAGES,
} from "@/lib/speech/languages";
import { playAccessibleChime } from "@/lib/voice";

export interface UseVoiceAssistantOptions {
  initialLanguage?: string;
  initialProvider?: SpeechProviderType;
  autoSpeakResponses?: boolean;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onStateChange?: (state: VoiceState) => void;
  onError?: (error: SpeechError) => void;
}

export interface UseVoiceAssistantReturn {
  state: VoiceState;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  transcript: string;
  interimTranscript: string;
  activeLanguage: string;
  activeProvider: SpeechProviderType;
  lastSpokenText: string | null;
  errorMessage: string | null;
  permissionDenied: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  speak: (text: string, lang?: string) => Promise<void>;
  stopSpeaking: () => void;
  pauseSpeaking: () => void;
  resumeSpeaking: () => void;
  repeatLastSpoken: () => void;
  setLanguage: (lang: string) => void;
  setProvider: (provider: SpeechProviderType) => void;
  setVoiceState: (state: VoiceState) => void;
}

export function useVoiceAssistant(
  options: UseVoiceAssistantOptions = {}
): UseVoiceAssistantReturn {
  const {
    initialLanguage = "en",
    initialProvider = "auto",
    autoSpeakResponses = true,
    onTranscript,
    onStateChange,
    onError,
  } = options;

  const [state, setState] = useState<VoiceState>("IDLE");
  const [activeLanguage, setActiveLanguage] = useState<string>(initialLanguage);
  const [activeProvider, setActiveProvider] = useState<SpeechProviderType>(initialProvider);
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [lastSpokenText, setLastSpokenText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const speechService = useRef(getSpeechService(initialProvider));
  const lastSpokenTextRef = useRef<string | null>(null);
  const activeLanguageRef = useRef(activeLanguage);
  activeLanguageRef.current = activeLanguage;

  const updateState = useCallback(
    (nextState: VoiceState) => {
      setState(nextState);
      onStateChange?.(nextState);
    },
    [onStateChange]
  );

  /**
   * Immediately halt any ongoing audio playback or speech synthesis (Barge-In)
   */
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause();
        currentAudioElementRef.current.currentTime = 0;
        currentAudioElementRef.current = null;
      }
    }
    if (state === "SPEAKING") {
      updateState("IDLE");
    }
  }, [state, updateState]);

  const pauseSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
    }
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.play().catch(() => {});
    }
  }, []);

  /**
   * Synthesize and Speak Text using unified Multi-Provider Cascade
   */
  const speak = useCallback(
    async (text: string, langOverride?: string): Promise<void> => {
      if (!text || !text.trim()) return;
      stopSpeaking();

      const cleanText = text
        .replace(/\[ACTION:.*?\]/g, "")
        .replace(/```[\s\S]*?```/g, "Code block.")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .trim();

      if (!cleanText) return;

      const detectedLang = langOverride || detectLanguageFromText(cleanText) || activeLanguageRef.current;
      setActiveLanguage(detectedLang);
      setLastSpokenText(cleanText);
      lastSpokenTextRef.current = cleanText;
      updateState("SPEAKING");

      try {
        const audioResult = await speechService.current.textToSpeech(cleanText, {
          language: detectedLang,
        });

        if (audioResult.useNativeSynthesis) {
          // Fallback to browser SpeechSynthesis
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

            utterance.onend = () => {
              updateState("IDLE");
            };
            utterance.onerror = () => {
              updateState("IDLE");
            };

            window.speechSynthesis.speak(utterance);
          } else {
            updateState("IDLE");
          }
        } else if (audioResult.audioBuffer) {
          // Playback cloud MP3 audio buffer
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
            updateState("IDLE");
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            currentAudioElementRef.current = null;
            updateState("IDLE");
          };

          await audio.play();
        }
      } catch (err: any) {
        console.warn("[useVoiceAssistant] TTS playback error:", err);
        updateState("IDLE");
      }
    },
    [stopSpeaking, updateState]
  );

  const repeatLastSpoken = useCallback(() => {
    if (lastSpokenTextRef.current) {
      speak(lastSpokenTextRef.current, activeLanguageRef.current);
    }
  }, [speak]);

  /**
   * Stop speech recognition
   */
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setInterimTranscript("");
    if (state === "LISTENING") {
      updateState("IDLE");
    }
  }, [state, updateState]);

  /**
   * Start Speech Recognition with Verbal Barge-In & Language Detection
   */
  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
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
      return;
    }

    // Stop ongoing recognition if any
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    try {
      const recognition = new SpeechRec();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;

      const langObj = getSupportedLanguage(activeLanguageRef.current);
      recognition.lang = langObj.speechRecognitionLocale;

      recognition.onstart = () => {
        isListeningRef.current = true;
        updateState("LISTENING");
        playAccessibleChime("start");
      };

      // ── Instant Barge-In on voice activity ──
      recognition.onspeechstart = () => {
        stopSpeaking();
      };

      recognition.onresult = (event: any) => {
        stopSpeaking();

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
          setTranscript(cleanFinal);
          setInterimTranscript("");

          // ── Verbal Interruption Command Interceptor ──
          const lower = cleanFinal.toLowerCase();
          if (
            lower === "stop" ||
            lower === "wait" ||
            lower === "pause" ||
            lower === "રોકો" ||
            lower === "रुको" ||
            lower === "arrête" ||
            lower === "stop speaking"
          ) {
            stopSpeaking();
            playAccessibleChime("stop");
            return;
          }

          if (
            lower === "repeat" ||
            lower === "say that again" ||
            lower === "ફરીથી કહો" ||
            lower === "दोहराएं" ||
            lower === "répéter"
          ) {
            repeatLastSpoken();
            return;
          }

          // Detect spoken language from final transcript
          const detected = detectLanguageFromText(cleanFinal);
          if (detected && detected !== activeLanguageRef.current) {
            setActiveLanguage(detected);
            activeLanguageRef.current = detected;
          }

          onTranscript?.(cleanFinal, true);
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
        } else if (rawErr !== "no-speech" && rawErr !== "aborted") {
          const err: SpeechError = {
            type: "recognition_failed",
            message: `Recognition error: ${rawErr}`,
            provider: "web",
          };
          setErrorMessage(err.message);
          onError?.(err);
        }
        isListeningRef.current = false;
        updateState("IDLE");
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          // Restart if still marked as listening
          try {
            recognition.start();
          } catch {
            isListeningRef.current = false;
            updateState("IDLE");
          }
        } else {
          updateState("IDLE");
        }
      };

      recognition.start();
    } catch (err: any) {
      console.error("[useVoiceAssistant] Speech init failed:", err);
      const errorObj: SpeechError = {
        type: "recognition_failed",
        message: "Microphone initialization failed. Please check permissions.",
        provider: "web",
        originalError: err,
      };
      setErrorMessage(errorObj.message);
      onError?.(errorObj);
      updateState("IDLE");
    }
  }, [onError, onTranscript, repeatLastSpoken, stopSpeaking, updateState]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current || state === "LISTENING") {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening, state]);

  const setLanguage = useCallback((lang: string) => {
    setActiveLanguage(lang);
    activeLanguageRef.current = lang;
  }, []);

  const setProvider = useCallback((provider: SpeechProviderType) => {
    setActiveProvider(provider);
    speechService.current.setProvider(provider);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [stopSpeaking]);

  return {
    state,
    isListening: state === "LISTENING",
    isSpeaking: state === "SPEAKING",
    isThinking: state === "AI_THINKING",
    transcript,
    interimTranscript,
    activeLanguage,
    activeProvider,
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
    setVoiceState: updateState,
  };
}
