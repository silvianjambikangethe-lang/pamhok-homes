"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Renders nothing. Polls a small "fingerprint" endpoint and, the moment it
// changes (a guest booked, paid, uploaded an ID, sent a request, left a review
// and so on), re-renders the current page's server data with router.refresh().
// Client-side state (open forms, typed text) is kept by the refresh. Pauses
// while the tab is hidden and checks straight away when it comes back.
export default function LivePulse({
  endpoint,
  intervalMs = 5000,
}: {
  endpoint: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const last = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const { fingerprint } = (await res.json()) as { fingerprint?: string };
        if (!fingerprint) return;
        if (last.current !== null && last.current !== fingerprint) router.refresh();
        last.current = fingerprint;
      } catch {
        // Network hiccup: the next tick tries again.
      }
    }

    void check();
    const timer = setInterval(check, intervalMs);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [endpoint, intervalMs, router]);

  return null;
}
