import type { Config } from "tailwindcss";

// Colors, radius and shadows below are ported 1:1 from the Checklist app's
// assets/style.css :root tokens (same GemPundit design system), so this repo
// renders with the same palette instead of an approximation.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Structural neutrals (Checklist --g-*)
        g950: "#12161c",
        g900: "#1f2733",
        g800: "#2c3644",
        g700: "#3d4854",
        g600: "#5a6472",
        g500: "#8a93a1",
        g400: "#aab2bf",
        g300: "#c2cad4",
        g200: "#e7eaef",
        g150: "#eef1f4",
        g100: "#f2f4f6",
        g50: "#f7f8fa",
        g0: "#ffffff",

        // Semantic aliases used throughout this app's existing components
        paper: "#fbfbfa", // Checklist --bg
        surface: "#ffffff", // --g-0
        ink: "#1f2733", // --g-900
        slate: "#8a93a1", // --g-500
        line: "#e7eaef", // --g-200

        // Brand teal (Checklist --ink / --ink-dark — unrelated to our `ink` text color above)
        sapphire: "#2f6f66",
        "sapphire-dark": "#2b5f57",
        "sapphire-soft": "#e7f1ee",
        "sapphire-border": "#bfd8d1",
        "sapphire-ring": "#cde4de",

        // Status semantics (Checklist --s-*)
        done: "#3f7a4f",
        "done-bg": "#edf4ee",
        progress: "#3d6b8a",
        "progress-bg": "#eaf1f5",
        delay: "#b3742a",
        "delay-bg": "#f8efe0",
        overdue: "#c0392b",
        "overdue-bg": "#fbeceb",
        blocked: "#6b5a8f",
        "blocked-bg": "#efecf5",

        // Kept for any not-yet-migrated usage; values now match the closest
        // Checklist status color rather than the old bespoke palette.
        emerald: "#3f7a4f",
        "emerald-light": "#edf4ee",
        ruby: "#c0392b",
        "ruby-dark": "#a5301f",
        "ruby-light": "#fbeceb",
        topaz: "#b3742a",
        "topaz-dark": "#96630f",
        amethyst: "#6b5a8f",
        "amethyst-dark": "#553b7c"
      },
      fontFamily: {
        sans: ["var(--font-hanken)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"]
      },
      borderRadius: {
        sm: "7px",
        DEFAULT: "7px",
        md: "9px",
        lg: "13px"
      },
      boxShadow: {
        sm: "0 1px 2px rgba(20,28,40,0.07)",
        md: "0 4px 14px rgba(20,28,40,0.10)",
        lg: "0 14px 34px -12px rgba(20,28,40,0.28)"
      }
    }
  },
  plugins: []
};

export default config;
