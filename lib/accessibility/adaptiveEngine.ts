/**
 * lib/accessibility/adaptiveEngine.ts
 *
 * UBIX Adaptive Interface Engine
 *
 * Translates explicit user Accessibility Passport configurations into deterministic,
 * responsive design tokens, layout modes, ARIA enhancements, and cognitive pacing.
 *
 * Invariant:
 * - Adapts strictly from confirmed user settings.
 * - Never makes algorithmic assumptions about user abilities.
 */

import { AccessibilityPassport, DEFAULT_ACCESSIBILITY_PASSPORT } from "./passport";

export interface AdaptivePresentationTokens {
  // Typography
  textSizeClass: string;
  headingSizeClass: string;
  lineHeightClass: string;
  // Contrast & Obsidian-Ink Palette
  surfaceClass: string;
  borderClass: string;
  textClass: string;
  focusVisibleClass: string;
  // Motion & Animation
  motionAllowed: boolean;
  transitionClass: string;
  // Layout & Spacing
  containerPaddingClass: string;
  gridDensityClass: string;
  cardSpacingClass: string;
  // Cognitive & Language
  simplifyContent: boolean;
  showStepNumbers: boolean;
  // Modality States
  voiceInputEnabled: boolean;
  voiceFeedbackEnabled: boolean;
  showLiveTranscripts: boolean;
  transcriptPlacement: "inline" | "dedicated_panel" | "none";
  ariaLiveMode: "polite" | "assertive" | "off";
  skipLinkAlwaysVisible: boolean;
}

/**
 * Computes deterministic presentation tokens for any given Accessibility Passport.
 */
export function computeAdaptiveTokens(
  passport: AccessibilityPassport = DEFAULT_ACCESSIBILITY_PASSPORT
): AdaptivePresentationTokens {
  // Typography
  const textSizeClass =
    passport.textSize === "xlarge"
      ? "text-lg md:text-xl"
      : passport.textSize === "large"
      ? "text-base md:text-lg"
      : "text-sm md:text-base";

  const headingSizeClass =
    passport.textSize === "xlarge"
      ? "text-2xl md:text-4xl font-bold tracking-tight"
      : passport.textSize === "large"
      ? "text-xl md:text-3xl font-bold tracking-tight"
      : "text-lg md:text-2xl font-semibold tracking-tight";

  const lineHeightClass =
    passport.textSize === "xlarge" || passport.simplifiedLanguage
      ? "leading-relaxed"
      : "leading-normal";

  // Contrast
  let surfaceClass = "bg-bg";
  let borderClass = "border-hairline";
  let textClass = "text-ink";
  let focusVisibleClass =
    "focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none";

  if (passport.contrast === "maximum") {
    surfaceClass = "bg-black";
    borderClass = "border-white border-2";
    textClass = "text-white font-medium";
    focusVisibleClass = "focus-visible:ring-4 focus-visible:ring-yellow-300 focus-visible:outline-none";
  } else if (passport.contrast === "high") {
    surfaceClass = "bg-surface-sunken";
    borderClass = "border-white/25";
    textClass = "text-white";
    focusVisibleClass = "focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:outline-none";
  }

  // Motion
  const motionAllowed = !passport.reducedMotion;
  const transitionClass = motionAllowed
    ? "transition-all duration-200 ease-out"
    : "transition-none";

  // Layout & Spacing
  const containerPaddingClass = passport.simplifiedLayout ? "p-6 md:p-8" : "p-4 md:p-6";
  const gridDensityClass = passport.simplifiedLayout ? "grid-cols-1 gap-6" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
  const cardSpacingClass = passport.simplifiedLayout ? "space-y-6" : "space-y-4";

  // Modality States
  const voiceInputEnabled = passport.profile !== "deaf_hard_of_hearing" && passport.voiceEnabled;
  const voiceFeedbackEnabled = passport.profile !== "deaf_hard_of_hearing" && passport.voiceFeedback;
  const showLiveTranscripts = passport.captionsEnabled || passport.profile === "deaf_hard_of_hearing";

  const ariaLiveMode =
    passport.screenReaderOptimized && passport.screenReaderVerbosity === "verbose"
      ? "assertive"
      : "polite";

  return {
    textSizeClass,
    headingSizeClass,
    lineHeightClass,
    surfaceClass,
    borderClass,
    textClass,
    focusVisibleClass,
    motionAllowed,
    transitionClass,
    containerPaddingClass,
    gridDensityClass,
    cardSpacingClass,
    simplifyContent: passport.simplifiedLanguage,
    showStepNumbers: passport.stepByStepGuidance,
    voiceInputEnabled,
    voiceFeedbackEnabled,
    showLiveTranscripts,
    transcriptPlacement: passport.transcriptPreference,
    ariaLiveMode,
    skipLinkAlwaysVisible: passport.skipLinksVisibleAlways,
  };
}
