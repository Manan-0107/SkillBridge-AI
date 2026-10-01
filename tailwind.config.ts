import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./providers/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Dark Obsidian Design System ──────────────────────────
        paper:   "#0A0C0F",          // deep void background
        surface: "#111418",          // card / panel surface
        surfaceHover: "#16191E",     // hover state for panels
        ink:     "#F0F2F5",          // primary text (near-white)
        graphite:"#7A8494",          // secondary / muted text
        line:    "#1E2228",          // hairline borders
        mist:    "#161A1F",          // subtle fill (hover bg)
        accent:  "#22D3EE",          // electric cyan accent
        accentDim:"#0891B2",         // muted accent
        accentGlow:"rgba(34,211,238,0.12)", // accent ambient
        // Legacy aliases kept for component compat
        border:  "#1E2228",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body:    ["var(--font-body)", "sans-serif"],
        mono:    ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        "glass":  "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 4px 32px 0 rgba(0,0,0,0.45)",
        "glow-accent": "0 0 20px rgba(34,211,238,0.18)",
        "panel":  "0 0 0 1px rgba(255,255,255,0.05), 0 8px 48px rgba(0,0,0,0.5)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(ellipse at center, var(--tw-gradient-stops))",
      },
      animation: {
        "fade-up": "fade-up 0.4s ease both",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(34,211,238,0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(34,211,238,0.5)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
