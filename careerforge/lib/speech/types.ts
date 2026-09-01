/**
 * lib/speech/types.ts
 *
 * Core TypeScript Interfaces for CareerForge Multi-Provider Multilingual Voice AI System.
 * Connects Web Speech API, Microsoft Azure AI Speech, and Google Cloud Speech
 * with unified abstractions, error classifications, and conversation states.
 */

export type SpeechProviderType = "web" | "azure" | "google" | "auto";

export type SpeechErrorType =
  | "permission_denied"
  | "unsupported"
  | "network"
  | "authentication"
  | "quota"
  | "language_not_supported"
  | "recognition_failed"
  | "unknown";

export interface SpeechError {
  type: SpeechErrorType;
  message: string;
  provider?: SpeechProviderType;
  originalError?: unknown;
}

export interface SpeechOptions {
  language?: string;
  candidateLanguages?: string[];
  continuous?: boolean;
  interimResults?: boolean;
  voiceName?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (result: SpeechResult) => void;
  onError?: (error: SpeechError) => void;
}

export interface SpeechResult {
  text: string;
  language?: string;
  confidence?: number;
  provider: SpeechProviderType;
  isFinal?: boolean;
}

export interface AudioResult {
  audioBuffer?: ArrayBuffer | Blob;
  audioUrl?: string;
  provider: SpeechProviderType;
  useNativeSynthesis?: boolean;
  mimeType?: string;
}

export interface LanguageResult {
  language: string;
  confidence: number;
  provider: SpeechProviderType;
}

export interface SpeechProvider {
  name: SpeechProviderType;
  isAvailable(): Promise<boolean> | boolean;
  speechToText(audio: Blob | ArrayBuffer, options?: SpeechOptions): Promise<SpeechResult>;
  textToSpeech(text: string, options?: SpeechOptions): Promise<AudioResult>;
  detectLanguage?(audio: Blob | ArrayBuffer, options?: { candidateLanguages?: string[] }): Promise<LanguageResult>;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  speechRecognitionLocale: string;
  speechSynthesisLocale: string;
  azureLocale: string;
  googleLocale: string;
  azureVoiceName?: string;
  googleVoiceName?: string;
}

export interface ConversationLanguageState {
  detectedLanguage: string;
  preferredLanguage?: string;
  lastDetectedLanguage?: string;
  confidence?: number;
}

export interface SpeechConfig {
  defaultProvider: SpeechProviderType;
  enableWebSpeech: boolean;
  enableAzure: boolean;
  enableGoogle: boolean;
  supportedLanguages: string[];
  fallbackEnabled: boolean;
}

export type VoiceState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "AI_THINKING"
  | "SPEAKING"
  | "ERROR";

export interface AgentContext {
  userId?: string;
  currentPage: string;
  currentLanguage: string;
  interactionMode: "voice" | "text" | "hybrid";
  accessibilityPreferences?: {
    interactionMode?: "voice" | "text" | "hybrid";
    speechOutput?: boolean;
    voiceNavigation?: boolean;
    simplifiedLanguage?: boolean;
    captions?: boolean;
    highContrast?: boolean;
    largeText?: boolean;
    reducedMotion?: boolean;
  };
  conversationId?: string;
  currentEntity?: {
    type: string;
    id?: string;
    title?: string;
    data?: unknown;
  };
}
