import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// The QR code on a guest's arrival pass is meant to be shown to other people
// (reception, security). It must therefore NOT contain the booking's private
// portal link, which opens the whole guest page (door code, Wi-Fi, receipt,
// requests). Instead it carries the booking id plus a signature made with a
// server-only secret. The signature can't be produced without that secret, so
// the code can't be forged for another booking, and it can't be turned back
// into the private link.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(bookingId: string): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("A server secret is required to sign verification codes.");
  return createHmac("sha256", `pamhok-verify-v1:${secret}`).update(bookingId.toLowerCase()).digest();
}

export function makeVerifyToken(bookingId: string): string {
  return `${bookingId}.${sign(bookingId).subarray(0, 24).toString("base64url")}`;
}

// Returns the booking id if the code is genuine, otherwise null.
export function parseVerifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [bookingId, signature] = parts;
  if (!UUID_RE.test(bookingId) || signature.length !== 32) return null;

  const expected = sign(bookingId).subarray(0, 24);
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? bookingId.toLowerCase() : null;
}
