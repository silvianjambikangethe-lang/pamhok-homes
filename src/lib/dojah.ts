import "server-only";
import type { IdVerificationResult } from "@/lib/supabase/types";

// Dojah document analysis — front + back ID check, no selfie/face-match.
// Works globally, not just Kenya, so it handles any guest's national ID or
// passport. See https://api.dojah.io (sandbox host below) for the full
// contract; DOJAH_ENV picks sandbox vs production the same way JENGA_ENV
// does for the M-Pesa integration. The App ID is shared across both
// environments, but the secret key differs, so sandbox and production keys
// are kept in separate env vars (DOJAH_SECRET_KEY_SANDBOX /
// DOJAH_SECRET_KEY_PRODUCTION) rather than one var that gets overwritten —
// that way flipping DOJAH_ENV back to sandbox for local testing doesn't
// require digging up the sandbox key again.
const isProduction = process.env.DOJAH_ENV === "production";
const DOJAH_BASE_URL = isProduction ? "https://api.dojah.io" : "https://sandbox.dojah.io";

type DojahDocumentStatus = {
  overall_status?: number | string;
  reason?: string;
  document_type?: string;
  document_images?: string;
  text?: string;
  expiry?: string;
};

// text_data is Dojah's OCR-extracted field list — present on the same
// response this integration already calls, just never read until now.
// field_key varies by document type/country (11,000+ document types), so
// name extraction below matches by pattern rather than a fixed key list.
// status: 1 = read successfully, 0 = not present on this document type,
// 2 = present but unreadable (damaged/blurry) — only 1 counts as usable.
type DojahTextField = {
  field_name?: string;
  field_key?: string;
  status?: number;
  value?: string;
};

// Best-effort name assembly from whichever name-shaped fields this
// document type actually exposes — a single "full_name"/"name" field if
// present, otherwise given+middle+surname pieced together. Returns null
// (not a failure) when no name field exists at all on this document
// type, so the caller can skip the match rather than wrongly failing a
// guest whose ID genuinely has no OCR-readable name field.
function extractNameFromTextData(textData: DojahTextField[]): string | null {
  const readable = (f: DojahTextField) => f.status === 1 && f.value?.trim();
  const findByPattern = (pattern: RegExp) =>
    textData.find(
      (f) => readable(f) && (pattern.test(f.field_key ?? "") || pattern.test(f.field_name ?? "")),
    )?.value?.trim();

  const fullName = findByPattern(/^(full[_ ]?name|name)$/i);
  if (fullName) return fullName;

  const given = findByPattern(/given[_ ]?names?|first[_ ]?name/i);
  const middle = findByPattern(/middle[_ ]?name/i);
  const surname = findByPattern(/surname|last[_ ]?name|family[_ ]?name/i);
  const parts = [given, middle, surname].filter((p): p is string => Boolean(p));

  return parts.length > 0 ? parts.join(" ") : null;
}

function normalizeNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1); // drop stray initials/punctuation noise
}

// Deliberately lenient, order-independent token overlap rather than exact
// string equality: ID field ordering ("Surname, Given Names") rarely
// matches how a guest types their own name at booking, and this is a
// fraud signal feeding into a retry-then-manual-review flow, not a
// silent hard block -- a false mismatch just costs a retry attempt, so
// erring conservative (fail on real mismatches, tolerate a missing
// middle name or minor OCR spelling slip) is the safer failure mode.
// Requiring only half the booking name's tokens keeps a single-token
// OCR misread from failing an otherwise-genuine match.
function namesLikelyMatch(bookingName: string, idName: string): boolean {
  const bookingTokens = normalizeNameTokens(bookingName);
  const idTokens = new Set(normalizeNameTokens(idName));
  if (bookingTokens.length === 0 || idTokens.size === 0) return true;

  const overlap = bookingTokens.filter((t) => idTokens.has(t)).length;
  return overlap / bookingTokens.length >= 0.5;
}

export type DocumentAnalysisOutcome =
  | { ok: true; passed: boolean; result: IdVerificationResult }
  // A provider-side/config problem (bad credentials, unfunded sandbox
  // wallet, network error, unexpected response shape) — never the guest's
  // fault, so callers should fall back to manual review without spending
  // one of the guest's two attempts.
  | { ok: false; error: string };

export async function analyzeIdDocument(
  frontBase64: string,
  backBase64: string,
  // Name on the booking, to cross-check against the ID's OCR-extracted
  // name. Optional so existing callers (and any future use of this
  // function outside the booking-name-match flow) keep working unchanged.
  guestName?: string,
): Promise<DocumentAnalysisOutcome> {
  const appId = process.env.DOJAH_APP_ID;
  const secretKey = isProduction
    ? process.env.DOJAH_SECRET_KEY_PRODUCTION
    : process.env.DOJAH_SECRET_KEY_SANDBOX;
  if (!appId || !secretKey) {
    const missingKeyVar = isProduction ? "DOJAH_SECRET_KEY_PRODUCTION" : "DOJAH_SECRET_KEY_SANDBOX";
    return { ok: false, error: `Dojah is not configured (missing DOJAH_APP_ID/${missingKeyVar}).` };
  }

  let response: Response;
  try {
    response = await fetch(`${DOJAH_BASE_URL}/api/v1/document/analysis`, {
      method: "POST",
      headers: {
        // Sent as-is — Dojah does not use a "Bearer" prefix.
        Authorization: secretKey,
        AppId: appId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input_type: "base64",
        imagefrontside: frontBase64,
        imagebackside: backBase64,
      }),
    });
  } catch {
    return { ok: false, error: "Could not reach Dojah." };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // 402 = wallet needs funding, 401 = bad credentials, 429 = rate
    // limited, 424 = Dojah's own analysis engine failed, 400 = unreadable
    // image. All are provider-side outcomes, not a "this ID is invalid"
    // verdict, so none of them should count against the guest's attempts.
    return {
      ok: false,
      error: `Dojah returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    };
  }

  const data = await response.json().catch(() => null);
  const status: DojahDocumentStatus | undefined = data?.entity?.status;
  if (!status) {
    return { ok: false, error: "Dojah returned an unexpected response shape." };
  }

  const documentValid = Number(status.overall_status) === 1;
  const checks: Record<string, string> = {
    document_type: status.document_type ?? "No",
    document_images: status.document_images ?? "No",
    text: status.text ?? "No",
    expiry: status.expiry ?? "No",
  };
  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value !== "Yes")
    .map(([key]) => key.replace(/_/g, " "));

  const textData: DojahTextField[] | undefined = data?.entity?.text_data;
  const extractedName = textData ? extractNameFromTextData(textData) : null;
  // No name field on this document type at all (extractedName === null) is
  // treated as a pass on the name check — nothing to compare against, and
  // the document's own authenticity checks above already ran. Only an
  // actual extracted name that fails to overlap with the booking name
  // counts as a mismatch.
  const nameMatches =
    !guestName || !extractedName || namesLikelyMatch(guestName, extractedName);

  const passed = documentValid && nameMatches;

  let resultText: string;
  if (passed) {
    resultText = "Document analysis passed.";
  } else if (!nameMatches) {
    resultText = `Name on ID ("${extractedName}") does not match the booking name ("${guestName}").`;
  } else {
    resultText =
      failedChecks.length > 0
        ? `Could not confirm: ${failedChecks.join(", ")}.`
        : "Document analysis did not pass.";
  }

  const result: IdVerificationResult = {
    success: passed,
    resultCode: status.reason ?? (passed ? "VALID" : nameMatches ? "INVALID" : "NAME_MISMATCH"),
    resultText,
    actions: checks,
    checkedAt: new Date().toISOString(),
    extractedName,
    nameMatch: extractedName ? nameMatches : null,
  };

  return { ok: true, passed, result };
}
