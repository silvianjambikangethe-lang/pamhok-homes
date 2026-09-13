// Emergency kill switch — flip back to false once the PayPal business
// account restriction (PAYEE_ACCOUNT_RESTRICTED, hit 2026-09-13) is
// resolved with PayPal directly. Not "server-only": read by both
// server routes (isPaypalConfigured() in lib/paypal.ts short-circuits
// on this) and client payment components (which hide the PayPal button
// entirely rather than showing it and erroring on click).
export const PAYPAL_DISABLED = true;
