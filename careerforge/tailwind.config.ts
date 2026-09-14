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
        charcoal: {
          950: "#0B0B0D", // Primary canvas background
          900: "#101114", // Surface layer 1
          850: "#141416", // Surface layer 2 / Card surface
          800: "#18191E", // Elevated surface (drawer/modal)
          700: "#22242B", // Hover states
          600: "#32353E",
          500: "#4D505B",
          400: "#7E8291", // Muted secondary text
          300: "#A8ACB9",
          200: "#D2D5DF", // Body text
          100: "#F0F2F7", // Highlight text
        },
        accent: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B", // Primary vivid accent
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
        status: {
          completed: "#34D399",
          "completed-bg": "#0D281E",
          "completed-border": "#1B4332",
          "in-progress": "#FBBF24",
          "in-progress-bg": "#2A1B07",
          "in-progress-border": "#4B320B",
          planned: "#94A3B8",
          "planned-bg": "#14171F",
          "planned-border": "#212735",
        },
        // Legacy light-theme tokens kept for backward compatibility
        paper: "#FAFAF8",
        ink: "#17171A",
        graphite: "#5B5B60",
        mist: "#EAEAE7",
        line: "#DEDEDA",
      },
      borderColor: {
        hairline: "rgba(255, 255, 255, 0.09)",
        "hairline-subtle": "rgba(255, 255, 255, 0.05)",
        "hairline-strong": "rgba(255, 255, 255, 0.16)",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Geist Sans",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "IBM Plex Mono",
          "Geist Mono",
          "monospace",
        ],
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
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
