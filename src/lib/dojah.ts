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

  const passed = Number(status.overall_status) === 1;
  const checks: Record<string, string> = {
    document_type: status.document_type ?? "No",
    document_images: status.document_images ?? "No",
    text: status.text ?? "No",
    expiry: status.expiry ?? "No",
  };
  const failedChecks = Object.entries(checks)
    .filter(([, value]) => value !== "Yes")
    .map(([key]) => key.replace(/_/g, " "));

  const result: IdVerificationResult = {
    success: passed,
    resultCode: status.reason ?? (passed ? "VALID" : "INVALID"),
    resultText: passed
      ? "Document analysis passed."
      : failedChecks.length > 0
        ? `Could not confirm: ${failedChecks.join(", ")}.`
        : "Document analysis did not pass.",
    actions: checks,
    checkedAt: new Date().toISOString(),
  };

  return { ok: true, passed, result };
}
