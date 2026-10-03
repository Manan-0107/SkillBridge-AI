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
        // ─── CareerForge Unified Dark Workspace Tokens ──────────────────────
        bg: "#080A0D",       // primary obsidian canvas background
        surface: "#111418",  // card/panel elevated surface
        "surface-elevated": "#171A21", // popovers, drawers, hover states
        "surface-sunken": "#0B0E13",   // input fields, recessed panels
        ink: "#F3F5F7",      // primary text — crisp high-contrast cool white
        accent: {
          DEFAULT: "#22D3EE", // electric cyan — technical, modern & clear
          soft: "#67E8F9",
        },
        info: "#38BDF8",
        success: "#34D399",
        danger: "#F87171",
        // ─── Compatibility aliases ──────────────────────────────────────────
        paper: "#080A0D",
        graphite: "#8E95A0",
        line: "rgba(255, 255, 255, 0.09)", // hairline border
        muted: "#64748B",
      },
      borderColor: {
        hairline: "rgba(255, 255, 255, 0.09)",
        "hairline-subtle": "rgba(255, 255, 255, 0.05)",
        "hairline-strong": "rgba(255, 255, 255, 0.18)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
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
