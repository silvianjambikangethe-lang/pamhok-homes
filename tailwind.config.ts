import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS-variable-backed: these are the only three slots whose actual
        // value flips between light/dark (page bg, card bg, primary text).
        // `rgb(var(--x) / <alpha-value>)` keeps Tailwind opacity modifiers
        // (e.g. text-ink/65) working against a variable.
        page: "rgb(var(--color-page) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",

        // Static brand colors — same hex in both themes. Where a role
        // swaps between themes (secondary button, "Paid" badge, locked
        // wash), that's handled with explicit dark: variants at the
        // usage site, not by changing what these tokens mean.
        terracotta: {
          DEFAULT: "#C4713C",
          50: "#FBEEE3",
          100: "#F4DAC2",
          300: "#DDA377",
          500: "#C4713C",
          600: "#AD5E2C",
          700: "#8C4A23",
        },
        gold: {
          DEFAULT: "#B08D57",
          50: "#F7F1E6",
          100: "#EBDFC6",
          300: "#CBAD7C",
          500: "#B08D57",
          700: "#856A40",
        },
        forest: {
          DEFAULT: "#3B4A3A",
          50: "#EAEEE9",
          100: "#CCD6CA",
          300: "#7E9179",
          500: "#3B4A3A",
          700: "#28332A",
          900: "#161E17",
        },
        sage: {
          DEFAULT: "#8A9A82",
          100: "#E4E9E1",
          300: "#B4C0AE",
          500: "#8A9A82",
          700: "#5F6E58",
        },
        espresso: {
          DEFAULT: "#2B211B",
          700: "#443630",
          500: "#6E5F54",
        },
        ivory: {
          DEFAULT: "#F5EFE6",
          dark: "#F0E9DD",
        },

        success: "#3F6A4C",
        danger: "#B5453C",
        // Legacy aliases kept only where a handful of call sites still
        // reference them for genuinely static UI chrome (not page/dark
        // sensitive) — new code should use the tokens above.
        clay: {
          DEFAULT: "#C4713C",
          50: "#FBEEE3",
          100: "#F4DAC2",
          300: "#DDA377",
          500: "#C4713C",
          600: "#AD5E2C",
          700: "#8C4A23",
          900: "#4E2310",
        },
        charcoal: {
          DEFAULT: "#2B211B",
          700: "#443630",
          500: "#6E5F54",
        },
        cream: {
          DEFAULT: "#F5EFE6",
          50: "#FFFDFA",
          100: "#F5EFE6",
          200: "#EDE4D6",
          300: "#EAD6B6",
        },
        sand: {
          DEFAULT: "#EDE4D6",
          50: "#F7F1E6",
          100: "#EDE4D6",
          200: "#D9C7A6",
        },
      },
      fontFamily: {
        // "Heading" font — Fraunces. Never italicized (reads as a mistake
        // per the type guide); Cormorant carries italic duty instead.
        serif: ["var(--font-fraunces)", "Georgia", "Times New Roman", "serif"],
        // "Body" font — Plus Jakarta Sans substitutes for General Sans
        // (not actually on Google Fonts; see layout.tsx comment).
        sans: [
          "var(--font-body)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        // "Accent/detail" font — Cormorant italic only (eyebrow labels,
        // pull-quotes). Never used for body copy or full paragraphs.
        accent: ["var(--font-cormorant)", "Georgia", "serif"],
      },
      fontSize: {
        // Type scale from typography-guide.md. Sizes that have a distinct
        // mobile/desktop value in the guide use clamp() to scale fluidly
        // between them instead of needing a separate sm: breakpoint class
        // at every call site.
        display: [
          "clamp(2.125rem, 1.35rem + 3.2vw, 3.5rem)",
          { lineHeight: "1.1", fontWeight: "500" },
        ],
        h1: [
          "clamp(1.75rem, 1.2rem + 2.2vw, 2.5rem)",
          { lineHeight: "1.15", fontWeight: "500" },
        ],
        h2: [
          "clamp(1.375rem, 1.05rem + 1.3vw, 1.75rem)",
          { lineHeight: "1.25", fontWeight: "500" },
        ],
        h3: [
          "clamp(1.125rem, 1rem + 0.5vw, 1.25rem)",
          { lineHeight: "1.3", fontWeight: "600" },
        ],
        body: ["1rem", { lineHeight: "1.7", fontWeight: "400" }],
        "body-sm": ["0.9375rem", { lineHeight: "1.7", fontWeight: "400" }],
        small: [
          "0.8125rem",
          { lineHeight: "1.5", letterSpacing: "0.2px", fontWeight: "400" },
        ],
        label: [
          "0.8125rem",
          { lineHeight: "1.4", letterSpacing: "2px", fontWeight: "500" },
        ],
        btn: [
          "0.875rem",
          { lineHeight: "1", letterSpacing: "0.3px", fontWeight: "500" },
        ],
        quote: [
          "clamp(1.125rem, 1rem + 0.5vw, 1.375rem)",
          { lineHeight: "1.5", fontWeight: "400" },
        ],
        price: [
          "clamp(1.625rem, 1.35rem + 1vw, 2rem)",
          { lineHeight: "1", fontWeight: "500" },
        ],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        warm: "0 8px 30px -8px rgba(43, 33, 27, 0.35)",
        card: "0 2px 12px -2px rgba(43, 33, 27, 0.12)",
      },
      maxWidth: {
        "7xl": "80rem",
      },
    },
  },
  plugins: [require("@tailwindcss/container-queries")],
};

export default config;
