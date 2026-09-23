// TEMPORARY, standalone smoke test — triggers a real Jenga UAT STK push
// using the JENGA_SANDBOX_* secrets (fully separate from the live JENGA_*
// ones mpesa-initiate uses for real guest payments). Callback points at
// mpesa-sandbox-callback, a logging-only throwaway function, so we can see
// the actual shape of a real callback before writing verification logic
// against it (Phase 1 of the blast-radius plan). Delete both once that's
// done — this is not part of the real feature.
//
// SANDBOX ONLY: hardcoded to uat.finserve.africa, does not read JENGA_ENV.

const AUTH_BASE = "https://uat.finserve.africa";

// Inlined from ../_shared/jenga.ts and ../_shared/cors.ts — the deploy tool
// used for this throwaway function doesn't resolve relative shared imports.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]*-----/, "")
    .replace(/-----END [^-]*-----/, "")
    .replace(/\\[nr]/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedKey: CryptoKey | null = null;

async function getPrivateKey(pem: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

async function signJenga(payload: string, privateKeyPem: string): Promise<string> {
  const key = await getPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(payload),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

Deno.serve(async (_req) => {
  const consumerKey = Deno.env.get("JENGA_SANDBOX_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("JENGA_SANDBOX_CONSUMER_SECRET");
  const merchantCode = Deno.env.get("JENGA_SANDBOX_MERCHANT_CODE");
  const privateKeyPem = Deno.env.get("JENGA_SANDBOX_PRIVATE_KEY");
  const accountNumber = "8458934278"; // sandbox collection wallet, given by the owner

  if (!consumerKey || !consumerSecret || !merchantCode || !privateKeyPem) {
    return json({ step: "config", error: "Missing JENGA_SANDBOX_ secrets." }, 501);
  }

  let accessToken: string;
  try {
    const authRes = await fetch(`${AUTH_BASE}/authentication/api/v3/authenticate/merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": consumerKey },
      body: JSON.stringify({ merchantCode, consumerSecret }),
    });
    const authBody = await authRes.text();
    if (!authRes.ok) {
      return json({ step: "authenticate", ok: false, status: authRes.status, body: authBody.slice(0, 1000) }, 200);
    }
    accessToken = JSON.parse(authBody).accessToken;
    if (!accessToken) {
      return json({ step: "authenticate", ok: false, note: "no accessToken in response", body: authBody.slice(0, 1000) }, 200);
    }
  } catch (err) {
    return json({ step: "authenticate", ok: false, error: String(err) }, 200);
  }

  const ref = `TST${Date.now().toString().slice(-3)}`.slice(0, 6).toUpperCase();
  const amount = "1.00";
  const phone = "254700000000"; // Jenga UAT test number — not a real device
  const today = new Date().toISOString().slice(0, 10);
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-sandbox-callback`;

  const signature = await signJenga(
    `${accountNumber}${ref}${phone}Safaricom${amount}KES`,
    privateKeyPem,
  );

  try {
    const stkRes = await fetch(`${AUTH_BASE}/v3-apis/payment-api/v3.0/stkussdpush/initiate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Signature: signature,
      },
      body: JSON.stringify({
        merchant: { accountNumber, countryCode: "KE", name: "Pamhok Homes" },
        payment: {
          ref,
          amount,
          currency: "KES",
          telco: "Safaricom",
          mobileNumber: phone,
          date: today,
          callBackUrl: callbackUrl,
          pushType: "STK",
        },
      }),
    });
    const stkBody = await stkRes.text();
    return json(
      { step: "stk-push", authOk: true, stkStatus: stkRes.status, stkBody: stkBody.slice(0, 1500), ref, callbackUrl },
      200,
    );
  } catch (err) {
    return json({ step: "stk-push", authOk: true, error: String(err) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
