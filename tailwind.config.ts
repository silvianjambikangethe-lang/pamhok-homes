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
        taupe: "rgb(var(--color-border) / <alpha-value>)",

        // Brown light theme tokens (light mode; see :root in globals.css).
        // Use these instead of typing hex values in components.
        pk: {
          bg: "var(--pk-bg)",
          surface: "var(--pk-surface)",
          sunken: "var(--pk-sunken)",
          line: "var(--pk-line)",
          field: "var(--pk-field)",
          text: "var(--pk-text)",
          "text-muted": "var(--pk-text-muted)",
          "text-subtle": "var(--pk-text-subtle)",
          "on-dark": "var(--pk-on-dark)",
          "on-dark-muted": "var(--pk-on-dark-muted)",
          primary: "var(--pk-primary)",
          "primary-hover": "var(--pk-primary-hover)",
          footer: "var(--pk-footer)",
          link: "var(--pk-link)",
          caramel: "var(--pk-caramel)",
          latte: "var(--pk-latte)",
          tan: "var(--pk-tan)",
          success: "var(--pk-success)",
          "success-bg": "var(--pk-success-bg)",
          warning: "var(--pk-warning)",
          "warning-bg": "var(--pk-warning-bg)",
          error: "var(--pk-error)",
          "error-bg": "var(--pk-error-bg)",
          info: "var(--pk-info)",
          "info-bg": "var(--pk-info-bg)",
        },

        // Brand colors. terracotta, gold, forest, mocha, mousse and danger are
        // variable-backed: brown theme in light mode, original values under
        // .dark (see globals.css). The rest are static hex. Where a role
        // swaps between themes (secondary button, "Paid" badge, locked
        // wash), that's handled with explicit dark: variants at the
        // usage site, not by changing what these tokens mean.
        terracotta: {
          DEFAULT: "rgb(var(--c-terracotta-500) / <alpha-value>)",
          50: "rgb(var(--c-terracotta-50) / <alpha-value>)",
          100: "rgb(var(--c-terracotta-100) / <alpha-value>)",
          300: "rgb(var(--c-terracotta-300) / <alpha-value>)",
          500: "rgb(var(--c-terracotta-500) / <alpha-value>)",
          600: "rgb(var(--c-terracotta-600) / <alpha-value>)",
          700: "rgb(var(--c-terracotta-700) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--c-gold-500) / <alpha-value>)",
          50: "rgb(var(--c-gold-50) / <alpha-value>)",
          100: "rgb(var(--c-gold-100) / <alpha-value>)",
          300: "rgb(var(--c-gold-300) / <alpha-value>)",
          500: "rgb(var(--c-gold-500) / <alpha-value>)",
          700: "rgb(var(--c-gold-700) / <alpha-value>)",
        },
        forest: {
          DEFAULT: "rgb(var(--c-forest-500) / <alpha-value>)",
          50: "rgb(var(--c-forest-50) / <alpha-value>)",
          100: "rgb(var(--c-forest-100) / <alpha-value>)",
          300: "rgb(var(--c-forest-300) / <alpha-value>)",
          500: "rgb(var(--c-forest-500) / <alpha-value>)",
          700: "rgb(var(--c-forest-700) / <alpha-value>)",
          900: "rgb(var(--c-forest-900) / <alpha-value>)",
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

        // Light-mode-only additions (master-color-scheme.md light mode
        // revision). Static hex, same in both themes by design — every
        // call site that needs these to differ in dark mode carries an
        // explicit dark: override rather than these tokens changing
        // meaning, matching the convention used above for terracotta/
        // gold/forest/etc.
        mousse: "rgb(var(--c-mousse) / <alpha-value>)", // Creamy Mousse — light text on a dark/mid fill
        cocoa: "#3A2418", // Rich Cocoa — dark text on a light/mid fill
        mocha: {
          DEFAULT: "rgb(var(--c-mocha-500) / <alpha-value>)",
          500: "rgb(var(--c-mocha-500) / <alpha-value>)",
          600: "rgb(var(--c-mocha-600) / <alpha-value>)",
        },

        success: "#3F6B3A",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
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
        // Text-block frame (about-us-text-framing.md) — lighter than
        // `card` since it's grounding static text, not lifting a photo.
        frame: "0 4px 20px rgba(62, 42, 32, 0.10)",
        // Photo/amenity card depth, resting and hover
        // (photo-frame-and-card-depth.md Layer 2).
        depth: "0 4px 20px rgba(62, 42, 32, 0.12)",
        "depth-hover": "0 8px 28px rgba(62, 42, 32, 0.18)",
      },
      maxWidth: {
        "7xl": "80rem",
      },
    },
  },
  plugins: [require("@tailwindcss/container-queries")],
};

export default config;
