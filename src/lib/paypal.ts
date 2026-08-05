import "server-only";

export function isPaypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalBaseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPaypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error("Could not authenticate with PayPal.");
  }

  const data = await res.json();
  return data.access_token as string;
}

// Full refund of a completed capture — no `amount` in the body means
// PayPal refunds the entire captured amount, so we never have to worry
// about currency/amount mismatches with what we originally charged.
export async function refundPaypalCapture(
  accessToken: string,
  captureId: string,
): Promise<{ ok: boolean; refundId?: string; error?: string }> {
  const res = await fetch(`${paypalBaseUrl()}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": crypto.randomUUID(),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.status !== "COMPLETED") {
    return {
      ok: false,
      error: data?.details?.[0]?.description ?? data?.message ?? "PayPal refund failed.",
    };
  }

  return { ok: true, refundId: data.id };
}
