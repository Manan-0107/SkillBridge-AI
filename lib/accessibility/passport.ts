/**
 * lib/accessibility/passport.ts
 *
 * UBIX Accessibility Passport
 *
 * A first-class, persistent user specification that governs all interaction,
 * presentation, and assistive capabilities across the platform.
 *
 * Invariants:
 * - Preferences are explicitly stated or confirmed by the user.
 * - Never infers medical or disability status from user activity.
 * - Backward-compatible with existing AccessibilityPreferences and AccessibilityProfile.
 */

import { AccessibilityPreferences, AccessibilityProfile } from "../store";

export type InteractionMode = "voice" | "text" | "hybrid" | "keyboard_only";
export type TextSizePreference = "normal" | "large" | "xlarge";
export type ContrastPreference = "standard" | "high" | "maximum";
export type TranscriptPreference = "inline" | "dedicated_panel" | "none";
export type KeyboardNavigationStyle = "standard" | "fast_tab" | "sticky_focus";
export type NotificationDelivery = "all" | "critical_only" | "silent_visual";
export type ScreenReaderVerbosity = "standard" | "verbose" | "minimal";

export interface AccessibilityPassport {
  version: "1.0.0";
  updatedAt: string;
  // Core Profile Alignment
  profile: AccessibilityProfile;
  // Interaction
  preferredInteractionMode: InteractionMode;
  voiceEnabled: boolean;
  voiceNavigation: boolean;
  voiceFeedback: boolean;
  // Visual & Display
  textSize: TextSizePreference;
  contrast: ContrastPreference;
  reducedMotion: boolean;
  simplifiedLayout: boolean;
  // Cognitive & Language
  simplifiedLanguage: boolean;
  stepByStepGuidance: boolean;
  // Audio & Hearing
  captionsEnabled: boolean;
  transcriptPreference: TranscriptPreference;
  soundNotificationsEnabled: boolean;
  // Screen Reader & Keyboard
  screenReaderOptimized: boolean;
  screenReaderVerbosity: ScreenReaderVerbosity;
  keyboardNavigationStyle: KeyboardNavigationStyle;
  skipLinksVisibleAlways: boolean;
  // Notifications
  notificationDelivery: NotificationDelivery;
}

export const DEFAULT_ACCESSIBILITY_PASSPORT: AccessibilityPassport = {
  version: "1.0.0",
  updatedAt: new Date(0).toISOString(),
  profile: "standard",
  preferredInteractionMode: "hybrid",
  voiceEnabled: true,
  voiceNavigation: false,
  voiceFeedback: true,
  textSize: "normal",
  contrast: "standard",
  reducedMotion: false,
  simplifiedLayout: false,
  simplifiedLanguage: false,
  stepByStepGuidance: false,
  captionsEnabled: true,
  transcriptPreference: "inline",
  soundNotificationsEnabled: false, // Default to no sound-only alarms
  screenReaderOptimized: false,
  screenReaderVerbosity: "standard",
  keyboardNavigationStyle: "standard",
  skipLinksVisibleAlways: false,
  notificationDelivery: "all",
};

/**
 * Creates an Accessibility Passport preset tailored to user-declared profiles.
 */
export function createPassportForProfile(
  profile: AccessibilityProfile,
  overrides: Partial<AccessibilityPassport> = {}
): AccessibilityPassport {
  const now = new Date().toISOString();

  if (profile === "blind_low_vision") {
    return {
      ...DEFAULT_ACCESSIBILITY_PASSPORT,
      profile: "blind_low_vision",
      updatedAt: now,
      preferredInteractionMode: "voice",
      voiceEnabled: true,
      voiceNavigation: true,
      voiceFeedback: true,
      textSize: "large",
      contrast: "high",
      reducedMotion: true,
      screenReaderOptimized: true,
      screenReaderVerbosity: "verbose",
      skipLinksVisibleAlways: true,
      soundNotificationsEnabled: true,
      ...overrides,
    };
  }

  if (profile === "deaf_hard_of_hearing") {
    return {
      ...DEFAULT_ACCESSIBILITY_PASSPORT,
      profile: "deaf_hard_of_hearing",
      updatedAt: now,
      preferredInteractionMode: "text",
      voiceEnabled: false,
      voiceNavigation: false,
      voiceFeedback: false,
      soundNotificationsEnabled: false,
      captionsEnabled: true,
      transcriptPreference: "dedicated_panel",
      notificationDelivery: "silent_visual",
      ...overrides,
    };
  }

  return {
    ...DEFAULT_ACCESSIBILITY_PASSPORT,
    profile: "standard",
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Maps legacy AccessibilityPreferences to modern AccessibilityPassport.
 */
export function fromLegacyPreferences(
  legacy: AccessibilityPreferences,
  profile: AccessibilityProfile = "standard"
): AccessibilityPassport {
  const base = createPassportForProfile(profile);

  return {
    ...base,
    updatedAt: new Date().toISOString(),
    preferredInteractionMode:
      legacy.interactionMode === "voice"
        ? "voice"
        : legacy.interactionMode === "text"
        ? "text"
        : "hybrid",
    voiceFeedback: legacy.speechOutput,
    voiceNavigation: legacy.voiceNavigation,
    voiceEnabled: profile !== "deaf_hard_of_hearing" && (legacy.speechOutput || legacy.voiceNavigation),
    simplifiedLanguage: legacy.simplifiedLanguage,
    captionsEnabled: legacy.captions,
    screenReaderOptimized: legacy.screenReaderMode,
    contrast: legacy.highContrast ? "high" : "standard",
    textSize: legacy.largeText ? "large" : "normal",
    reducedMotion: legacy.reducedMotion,
  };
}

/**
 * Validates passport payload against schema and returns sanitized passport.
 */
export function sanitizeAccessibilityPassport(input: any): AccessibilityPassport {
  if (!input || typeof input !== "object") {
    return DEFAULT_ACCESSIBILITY_PASSPORT;
  }

  const validProfiles: AccessibilityProfile[] = ["blind_low_vision", "deaf_hard_of_hearing", "standard"];
  const profile: AccessibilityProfile = validProfiles.includes(input.profile) ? input.profile : "standard";

  const base = createPassportForProfile(profile);

  return {
    version: "1.0.0",
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
    profile,
    preferredInteractionMode: ["voice", "text", "hybrid", "keyboard_only"].includes(input.preferredInteractionMode)
      ? input.preferredInteractionMode
      : base.preferredInteractionMode,
    voiceEnabled: typeof input.voiceEnabled === "boolean" ? input.voiceEnabled : base.voiceEnabled,
    voiceNavigation: typeof input.voiceNavigation === "boolean" ? input.voiceNavigation : base.voiceNavigation,
    voiceFeedback: typeof input.voiceFeedback === "boolean" ? input.voiceFeedback : base.voiceFeedback,
    textSize: ["normal", "large", "xlarge"].includes(input.textSize) ? input.textSize : base.textSize,
    contrast: ["standard", "high", "maximum"].includes(input.contrast) ? input.contrast : base.contrast,
    reducedMotion: typeof input.reducedMotion === "boolean" ? input.reducedMotion : base.reducedMotion,
    simplifiedLayout: typeof input.simplifiedLayout === "boolean" ? input.simplifiedLayout : base.simplifiedLayout,
    simplifiedLanguage: typeof input.simplifiedLanguage === "boolean" ? input.simplifiedLanguage : base.simplifiedLanguage,
    stepByStepGuidance: typeof input.stepByStepGuidance === "boolean" ? input.stepByStepGuidance : base.stepByStepGuidance,
    captionsEnabled: typeof input.captionsEnabled === "boolean" ? input.captionsEnabled : base.captionsEnabled,
    transcriptPreference: ["inline", "dedicated_panel", "none"].includes(input.transcriptPreference)
      ? input.transcriptPreference
      : base.transcriptPreference,
    soundNotificationsEnabled:
      typeof input.soundNotificationsEnabled === "boolean"
        ? input.soundNotificationsEnabled
        : base.soundNotificationsEnabled,
    screenReaderOptimized:
      typeof input.screenReaderOptimized === "boolean" ? input.screenReaderOptimized : base.screenReaderOptimized,
    screenReaderVerbosity: ["standard", "verbose", "minimal"].includes(input.screenReaderVerbosity)
      ? input.screenReaderVerbosity
      : base.screenReaderVerbosity,
    keyboardNavigationStyle: ["standard", "fast_tab", "sticky_focus"].includes(input.keyboardNavigationStyle)
      ? input.keyboardNavigationStyle
      : base.keyboardNavigationStyle,
    skipLinksVisibleAlways:
      typeof input.skipLinksVisibleAlways === "boolean" ? input.skipLinksVisibleAlways : base.skipLinksVisibleAlways,
    notificationDelivery: ["all", "critical_only", "silent_visual"].includes(input.notificationDelivery)
      ? input.notificationDelivery
      : base.notificationDelivery,
  };
}
