# UBIX Architecture Governance: Accessibility (WCAG 2.1 AA)

## 1. Accessibility-First Architecture

UBIX is designed from the foundation for users with diverse sensory, motor, and cognitive modalities.

Every feature must independently satisfy:
- **Blind Users**: Complete keyboard navigability, logical focus flow, screen-reader labels, `aria-live="polite"` dynamic announcements, and audio cues.
- **Deaf Users**: Zero sound-only information; visible status badges, live transcripts for spoken audio, and complete visual equivalents.
- **Motor / Keyboard Users**: Full tab traversal, visible focus outlines (`focus-visible`), modal focus trapping, and Escape key dismissal.
- **Motion-Sensitive Users**: Respect `prefers-reduced-motion` across all transitions and Three.js scenes.

## 2. Interactive Feature Requirements

1. **Screen Reader Announcements**:
   - Asynchronous operations, speech recording states, and background tasks must announce status via `aria-live="polite"` or `aria-live="assertive"`.
2. **Audio & Voice Invariants**:
   - Voice interaction is strictly **event-driven**. Never introduce permanent or background microphone recording.
   - If audio recording yields no speech, show an explicit truthful message: *"No audio was detected."* Never fabricate fallback transcriptions.
   - Never vocalize sensitive passwords or private security tokens.
3. **Forms & Modals**:
   - Always associate `<label>` with inputs via `htmlFor`/`id`.
   - Never create visual-only buttons lacking accessible names or `aria-label`.
