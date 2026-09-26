import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./providers/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── CareerForge Design Tokens (Single Source of Truth) ─────────────
        bg: "#FAF6F1",       // page background — near-neutral cream, NOT saturated peach
        surface: "#F1E9DF",  // card/panel background — one shade deeper
        ink: "#14110F",      // primary text — warm near-black, not pure #000
        accent: {
          DEFAULT: "#B5541F", // rust/terracotta — used sparingly, never as a full-page button fill
          soft: "#C1652E",
        },
        info: "#2F4858",
        success: "#5C6B44",
        danger: "#99341F",
        // ─── Legacy aliases (used in AuthGate) ──────────────────────────────
        paper: "#FAF6F1",       // = bg
        graphite: "#6B6560",    // ≈ ink/60
        line: "rgba(20,17,15,0.12)", // hairline border
        muted: "#A09890",       // ≈ ink/40
      },
      borderColor: {
        hairline: "rgba(27, 24, 21, 0.12)",
        "hairline-subtle": "rgba(27, 24, 21, 0.06)",
        "hairline-strong": "rgba(27, 24, 21, 0.22)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace"],
        display: ["Inter", "ui-sans-serif"],
        body: ["Inter", "ui-sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.75rem" }],
      },
      borderRadius: {
        node: "0.875rem", // 14px
        drawer: "1.5rem", // 24px
        sheet: "1.75rem", // 28px
      },
      boxShadow: {
        drawer: "0 24px 60px -12px rgba(0, 0, 0, 0.75)",
        glow: "0 0 20px -3px rgba(245, 158, 11, 0.35)",
        "glow-completed": "0 0 16px -3px rgba(52, 211, 153, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
