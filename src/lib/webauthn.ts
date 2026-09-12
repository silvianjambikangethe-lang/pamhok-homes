import "server-only";
import { SITE } from "@/lib/site";

// Passkey login for /admin, tried as the primary factor with password as
// the fallback — not Supabase's built-in WebAuthn MFA, which requires a
// password sign-in FIRST and treats webauthn as a second factor (the
// opposite order of what was asked for). This is a hand-rolled ceremony
// on top of @simplewebauthn/server, with its own two tables
// (passkey_credentials, passkey_challenges — see the migration).
//
// rpID/origin are derived from the incoming request rather than
// hardcoded, so this works unmodified in both local dev (localhost) and
// production (the real domain) — WebAuthn requires an exact origin match
// and a valid rpID (the origin's own hostname, or a registrable parent
// of it), so getting this wrong makes every ceremony fail outright
// rather than silently degrade.

const PRODUCTION_ORIGIN = SITE.url;

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (origin === PRODUCTION_ORIGIN) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export function rpIdFromOrigin(origin: string): string {
  return new URL(origin).hostname;
}

// Challenges are single-use and short-lived — anything older than this
// is dead weight, swept opportunistically whenever a new one is created
// rather than needing a dedicated cron.
export const CHALLENGE_TTL_MINUTES = 5;
