import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF8",
        ink: "#17171A",
        graphite: "#5B5B60",
        mist: "#EAEAE7",
        line: "#DEDEDA",
        accent: "#3A4A5C",
      },
      fontFamily: {
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        body: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "1560px",
      },
    },
  },
  plugins: [],
};
export default config;
