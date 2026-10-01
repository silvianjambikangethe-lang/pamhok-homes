"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Same pattern PortalClient already uses to pick up an admin's ID
// verification decision without the guest reloading (poll a cheap status
// endpoint, diff the response against the last tick, router.refresh() on
// change) — generalized here so staff, admin, and guest views can all pick
// up each other's laundry updates (stage changes, payments, admin pricing)
// the same way, with nobody needing to refresh a tab by hand.
export function usePollRefresh(url: string, { enabled = true, intervalMs = 4000 } = {}) {
  const router = useRouter();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    lastRef.current = null;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const text = await res.text();
        if (lastRef.current !== null && lastRef.current !== text) {
          router.refresh();
        }
        lastRef.current = text;
      } catch {
        // Network hiccup — the next tick retries.
      }
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [url, enabled, intervalMs, router]);
}
