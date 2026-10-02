import "server-only";
import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail, guestRecognitionCodeEmail } from "@/lib/email";

// Returning-guest recognition for the /rooms "Remember Me" flow. A guest
// only ends up in remembered_guests after opting in at checkout on a
// booking that was actually ID-verified (see completeCheckout in
// src/lib/checkout.ts) — this file is purely about proving, on a later
// visit, that whoever is typing the stored email still controls it, before
// the booking route (see the recognitionToken branch in
// src/app/api/bookings/route.ts) trusts it enough to skip ID verification
// again. Name + email alone are never treated as identity.

// A remembered guest unused for this long is removed by
// /api/cron/purge-remembered-guests. "Used" means opting in again at
// checkout or signing in with an emailed code (both refresh updated_at).
export const REMEMBERED_GUEST_RETENTION_DAYS = 730;

const CODE_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 2;
const RECOGNITION_TOKEN_TTL_MS = 30 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Same salted-scrypt pattern as hashPin/verifyPin in src/lib/staff-pin.ts.
function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(code, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyCodeHash(code: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(code, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

// HMAC-signed, same construction as makeVerifyToken/parseVerifyToken in
// src/lib/verify-token.ts: nothing to forge it without the service-role
// secret, and it carries its own expiry so it isn't a standing credential.
function signPayload(payload: string): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("A server secret is required to sign recognition tokens.");
  return createHmac("sha256", `pamhok-recognition-v1:${secret}`).update(payload).digest();
}

export function makeRecognitionToken(email: string): string {
  const payload = `${normalizeEmail(email)}:${Date.now()}`;
  const signature = signPayload(payload).subarray(0, 24).toString("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

// Returns the normalized email if the token is genuine and unexpired, else null.
export function parseRecognitionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [email, issuedAtRaw] = payload.split(":");
  const issuedAt = Number(issuedAtRaw);
  if (!email || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > RECOGNITION_TOKEN_TTL_MS) return null;

  const expected = signPayload(payload).subarray(0, 24);
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? email : null;
}

// Always resolves the same way whether or not the email is remembered —
// callers must return a generic "ok" response either way so probing emails
// can't reveal who's on file (same anti-enumeration shape as
// cannotCompleteOnline() in src/app/api/bookings/route.ts).
export async function requestRecognitionCode(
  email: string,
  ip: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterMinutes: number }> {
  const normalized = normalizeEmail(email);

  const [byEmail, byIp] = await Promise.all([
    checkRateLimit("guest-recognition-request:email", normalized, { maxAttempts: 5, windowMinutes: 60 }),
    checkRateLimit("guest-recognition-request:ip", ip, { maxAttempts: 15, windowMinutes: 60 }),
  ]);
  if (!byEmail.allowed) return byEmail;
  if (!byIp.allowed) return byIp;

  const supabase = createAdminSupabaseClient();
  const { data: remembered } = await supabase
    .from("remembered_guests")
    .select("email, full_name")
    .eq("email", normalized)
    .maybeSingle();

  // Nothing on file: pretend we sent it. No row, no email.
  if (!remembered) return { allowed: true };

  // randomInt is Node's cryptographically secure generator, so each code
  // is unpredictable and independent of the last. Any older pending code
  // for this email is removed first, so only the newest one ever works.
  const code = String(randomInt(100000, 1000000));
  // Also sweep every expired code, so unused codes from guests who never
  // came back don't pile up in the table.
  await supabase
    .from("guest_recognition_codes")
    .delete()
    .lt("expires_at", new Date().toISOString());
  await supabase.from("guest_recognition_codes").delete().eq("email", normalized);
  await supabase.from("guest_recognition_codes").insert({
    email: normalized,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  });

  // Greets by the name on file (from the guest's own prior opt-in at
  // checkout), not whatever name was just typed into the "Remember Me"
  // form - that field isn't verified yet at this point in the flow.
  const { subject, html } = guestRecognitionCodeEmail({ code, fullName: remembered.full_name });
  const sent = await sendEmail({ to: normalized, subject, html });
  // The guest-facing response must stay generic either way (anti-
  // enumeration), but a failed send used to vanish into sendEmail's own
  // console.error with nothing tying it back to "this guest never got
  // their code" — this is the one place that can say so clearly.
  if (!sent) {
    console.error("guest-recognition: code generated but email failed to send", normalized);
  }

  return { allowed: true };
}

export async function verifyRecognitionCode(
  email: string,
  code: string,
  ip: string,
): Promise<
  | { ok: true; fullName: string; phone: string | null; recognitionToken: string }
  | { ok: false; error: string; status: number }
> {
  const normalized = normalizeEmail(email);

  const [byEmail, byIp] = await Promise.all([
    checkRateLimit("guest-recognition-verify:email", normalized, { maxAttempts: 5, windowMinutes: 15 }),
    checkRateLimit("guest-recognition-verify:ip", ip, { maxAttempts: 20, windowMinutes: 15 }),
  ]);
  if (!byEmail.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${byEmail.retryAfterMinutes} minute${byEmail.retryAfterMinutes === 1 ? "" : "s"}.`, status: 429 };
  }
  if (!byIp.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${byIp.retryAfterMinutes} minute${byIp.retryAfterMinutes === 1 ? "" : "s"}.`, status: 429 };
  }

  const supabase = createAdminSupabaseClient();
  const { data: codeRow } = await supabase
    .from("guest_recognition_codes")
    .select("id, code_hash, expires_at, attempts")
    .eq("email", normalized)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const genericError = { ok: false as const, error: "That code doesn't look right.", status: 400 };

  if (!codeRow || codeRow.attempts >= MAX_VERIFY_ATTEMPTS) return genericError;

  if (!verifyCodeHash(code.trim(), codeRow.code_hash)) {
    await supabase
      .from("guest_recognition_codes")
      .update({ attempts: codeRow.attempts + 1 })
      .eq("id", codeRow.id);
    return genericError;
  }

  // Single-use.
  await supabase.from("guest_recognition_codes").delete().eq("id", codeRow.id);

  const { data: remembered } = await supabase
    .from("remembered_guests")
    .select("full_name, phone")
    .eq("email", normalized)
    .maybeSingle();

  // The code only exists because requestRecognitionCode found a
  // remembered_guests row, so this should always be present.
  if (!remembered) return genericError;

  // Signing in counts as using it, which restarts the retention clock.
  await supabase
    .from("remembered_guests")
    .update({ updated_at: new Date().toISOString() })
    .eq("email", normalized);

  return {
    ok: true,
    fullName: remembered.full_name,
    phone: remembered.phone,
    recognitionToken: makeRecognitionToken(normalized),
  };
}
