import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // base
        paper: "#F7F6F2",     // page background — warm neutral, matches the reference design
        surface: "#FFFFFF",   // cards, inputs
        ink: "#1B2733",       // primary text
        slate: "#64748B",     // secondary/muted text
        line: "#DDE4ED",      // borders/dividers

        // section accents — one hue per form, used for wayfinding
        sapphire: "#2F6F66",       // primary brand accent (teal, per reference design)
        "sapphire-dark": "#234F49",
        topaz: "#B87A1A",
        "topaz-dark": "#96630F",
        amethyst: "#6B4C9A",
        "amethyst-dark": "#553B7C",

        // status — meaning stays consistent everywhere they appear
        emerald: "#16805A",
        "emerald-light": "#EAF7F1",
        ruby: "#C23B4B",
        "ruby-dark": "#9E2E3C",
        "ruby-light": "#FBEAEC"
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-manrope)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"]
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "14px"
      }
    }
  },
  plugins: []
};

export default config;
