import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

// Node's built-in scrypt rather than a new dependency — same reasoning
// this session already applied elsewhere (ffmpeg-static + child_process
// over fluent-ffmpeg) to avoid adding packages where the standard library
// already covers it. Stored as "salt:hash" (both hex) in one column.
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const candidate = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;

  return timingSafeEqual(candidate, expected);
}
