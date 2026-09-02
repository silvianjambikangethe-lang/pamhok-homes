import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase Edge Functions are Deno, not Node/Next.js — a different
    // runtime with its own globals (Deno.*), its own import scheme
    // (npm:/jsr: specifiers), and its own linter (`deno lint`, which
    // understands `// deno-lint-ignore` comments this config doesn't).
    // Linting them with this config produces false positives, not real
    // findings — keep them out of scope entirely.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
