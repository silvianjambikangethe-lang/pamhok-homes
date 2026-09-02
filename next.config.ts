import type { NextConfig } from "next";

// Everything the browser actually loads from, audited directly (not
// guessed): same-origin scripts/styles/fonts (self-hosted via
// next/font, no runtime Google Fonts CDN calls), Supabase Storage for
// room/site photos, and a direct browser->Supabase connection for auth
// (admin sign-out) and payment status polling — the only two places
// using the browser Supabase client. PayPal is a full top-level
// redirect (`window.location.href`), never an embedded script or
// iframe, so it needs no CSP allowance at all. No third-party embeds,
// no Google Maps JS SDK (directions open as plain links), no iframes
// anywhere in the codebase.
//
// Derived from NEXT_PUBLIC_SUPABASE_URL rather than hardcoded, so this
// file works unchanged for any Supabase project (not just this one) —
// falls back to this project's origin only for tooling that evaluates
// next.config.ts without an env file loaded (e.g. some lint/build
// steps), never at runtime, since NEXT_PUBLIC_SUPABASE_URL is always
// set in every real environment (local, Vercel).
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "https://ajxijucojqkxszfkepqr.supabase.co";

const CSP = [
  `default-src 'self'`,
  // 'unsafe-inline'/'unsafe-eval' rather than a nonce-based policy —
  // Next.js's own hydration/RSC bootstrap scripts and dev-mode HMR need
  // them; still blocks loading script from any attacker-controlled
  // remote origin, which is the actual clickjacking/injection defense.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: ${SUPABASE_ORIGIN}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${SUPABASE_ORIGIN}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join("; ");

const nextConfig: NextConfig = {
  images: {
    // next/image requires every external domain it optimizes to be
    // explicitly allowlisted — this is the only one the app ever loads
    // photos from (room/site photos in the "site-images" bucket).
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(SUPABASE_ORIGIN).hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  typescript: {
    // This machine's Application Control policy blocks native SWC bindings,
    // and the WASM SWC fallback's type-check pass crashes ("invalid type:
    // unit value, expected usize"). Type safety is still enforced via a
    // separate `tsc --noEmit` run (plain TypeScript compiler, no native
    // bindings involved) rather than skipped outright.
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
