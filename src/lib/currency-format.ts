import type { DisplayCurrency } from "@/lib/currency";

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KES" ? 0 : 2,
  }).format(amount);
}

// Rough locale → currency guess for defaulting the selector — the guest
// can always override it, this just saves a click for most people.
export function guessCurrencyFromLocale(locale: string): DisplayCurrency {
  const region = locale.split("-")[1]?.toUpperCase();
  if (region === "KE") return "KES";
  if (region === "GB") return "GBP";
  if (["US", "CA"].includes(region ?? "")) return "USD";
  if (["DE", "FR", "ES", "IT", "NL", "PT", "IE", "AT", "BE"].includes(region ?? "")) return "EUR";
  return "KES";
}
