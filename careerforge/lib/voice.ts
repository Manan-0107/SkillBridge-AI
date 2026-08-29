/**
 * Universal Client-Side Voice Engine (100% Free & Unlimited)
 * Built on Browser Native Web Speech API (SpeechSynthesis & SpeechRecognition)
 * with graceful fallback for all major browsers.
 */

// ─── 1. Text-to-Speech (SpeechSynthesis) ──────────────────────────────────────

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
}

export function isSpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  return window.speechSynthesis.speaking;
}

export function speakText(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
) {
  if (!isSpeechSynthesisSupported()) {
    callbacks?.onError?.("SpeechSynthesis not supported on this device.");
    return;
  }

  // Cancel any ongoing speech first
  window.speechSynthesis.cancel();

  // Clean Markdown & Action Tags from text for pleasant audio listening
  const cleanText = text
    .replace(/\[ACTION:.*?\]/g, "")
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/>\s/g, "")
    .replace(/[•\-\*]\s/g, "")
    .trim();

  if (!cleanText) {
    callbacks?.onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  activeUtterance = utterance;

  // Configure high-quality natural speech parameters
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Select best available voice (Google, Microsoft, Natural)
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Google") ||
        v.name.includes("Natural") ||
        v.name.includes("Samantha") ||
        v.name.includes("Daniel") ||
        v.name.includes("David"))
  ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.onstart = () => {
    callbacks?.onStart?.();
  };

  utterance.onend = () => {
    activeUtterance = null;
    callbacks?.onEnd?.();
  };

  utterance.onerror = (e) => {
    activeUtterance = null;
    callbacks?.onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}

// ─── 2. Speech-to-Text (SpeechRecognition) ────────────────────────────────────

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export type SpeechRecognitionController = {
  stop: () => void;
};

export function startSpeechRecognition(
  callbacks: {
    onTranscript: (text: string, isFinal: boolean) => void;
    onListeningChange: (listening: boolean) => void;
    onError: (error: string) => void;
  }
): SpeechRecognitionController | null {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
    callbacks.onListeningChange(false);
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      callbacks.onListeningChange(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (final) {
        callbacks.onTranscript(final, true);
      } else if (interim) {
        callbacks.onTranscript(interim, false);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.warn("[Voice] Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        callbacks.onError(event.error || "Microphone recognition error");
      }
      callbacks.onListeningChange(false);
    };

    recognition.onend = () => {
      callbacks.onListeningChange(false);
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
        callbacks.onListeningChange(false);
      },
    };
  } catch (err) {
    console.error("[Voice] Failed to initialize speech recognition:", err);
    callbacks.onError("Failed to start microphone. Please check permissions.");
    callbacks.onListeningChange(false);
    return null;
  }
}
