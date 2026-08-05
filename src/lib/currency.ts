import "server-only";

export const DISPLAY_CURRENCIES = ["KES", "USD", "EUR", "GBP"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

// Frankfurter (frankfurter.app) — free, no API key, backed by European
// Central Bank reference rates. Cached for a day so this never fires on
// every page load, per the multi-currency brief. Resolved server-side and
// passed down as a prop — client components never fetch rates directly.
const CACHE_SECONDS = 60 * 60 * 24;

let memoryCache: { rates: Record<string, number>; fetchedAt: number } | null = null;

export async function getExchangeRates(): Promise<Record<DisplayCurrency, number>> {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < CACHE_SECONDS * 1000) {
    return memoryCache.rates as Record<DisplayCurrency, number>;
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=KES&to=${DISPLAY_CURRENCIES.filter((c) => c !== "KES").join(",")}`,
      { next: { revalidate: CACHE_SECONDS } },
    );
    if (!res.ok) throw new Error("Rate lookup failed");
    const data = await res.json();
    const rates = { KES: 1, ...data.rates } as Record<DisplayCurrency, number>;
    memoryCache = { rates, fetchedAt: Date.now() };
    return rates;
  } catch {
    // Stale-but-plausible fallback so the UI still shows *something*
    // rather than breaking if the free rate API is ever unreachable.
    return (memoryCache?.rates as Record<DisplayCurrency, number>) ?? {
      KES: 1,
      USD: 0.0078,
      EUR: 0.0072,
      GBP: 0.0061,
    };
  }
}
