// Client-side only (no "server-only" — used from both RoomsBrowser and
// BookingWidget). Holds the proof of a successful "Remember Me" code
// verification for the rest of this browser tab's session: sessionStorage,
// not localStorage, so it disappears when the tab closes rather than
// lingering like a standing login, and never goes in the URL since
// recognitionToken is a signed secret (see src/lib/guest-recognition.ts).
export const RECOGNITION_STORAGE_KEY = "pamhok_recognition";

// Mirrors RECOGNITION_TOKEN_TTL_MS in src/lib/guest-recognition.ts — the
// server is the actual authority on expiry; this just avoids showing a
// "Welcome back" state the server would reject anyway.
const RECOGNITION_TTL_MS = 30 * 60 * 1000;

export type StoredRecognition = {
  recognitionToken: string;
  fullName: string;
  email: string;
  // null when no number was kept (older opt-ins, or none on file).
  phone: string | null;
  issuedAt: number;
};

export function readStoredRecognition(): StoredRecognition | null {
  try {
    const raw = sessionStorage.getItem(RECOGNITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRecognition>;
    if (
      typeof parsed.recognitionToken !== "string" ||
      typeof parsed.fullName !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.issuedAt > RECOGNITION_TTL_MS) {
      sessionStorage.removeItem(RECOGNITION_STORAGE_KEY);
      return null;
    }
    return { ...(parsed as StoredRecognition), phone: typeof parsed.phone === "string" ? parsed.phone : null };
  } catch {
    return null;
  }
}

export function writeStoredRecognition(value: StoredRecognition) {
  try {
    sessionStorage.setItem(RECOGNITION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable — the guest just stays unrecognized this visit.
  }
}

export function clearStoredRecognition() {
  try {
    sessionStorage.removeItem(RECOGNITION_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
