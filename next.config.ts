import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // This machine's Application Control policy blocks native SWC bindings,
    // and the WASM SWC fallback's type-check pass crashes ("invalid type:
    // unit value, expected usize"). Type safety is still enforced via a
    // separate `tsc --noEmit` run (plain TypeScript compiler, no native
    // bindings involved) rather than skipped outright.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
