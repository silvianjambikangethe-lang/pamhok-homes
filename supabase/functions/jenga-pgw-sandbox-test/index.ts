// TEMPORARY, standalone smoke test — not wired into the app, not called by
// any page. Answers exactly one question: does the SAME bearer token our
// M-Pesa STK push already gets (via the existing JENGA_CONSUMER_KEY /
// CONSUMER_SECRET / MERCHANT_CODE / PRIVATE_KEY secrets) get accepted by
// Jenga PGW's card checkout, or does PGW need a separate credential?
//
// SANDBOX ONLY: hardcoded to uat.finserve.africa (auth) and
// v3-uat.jengapgw.io (checkout) — does not read JENGA_ENV, so it can never
// touch production regardless of that secret's value. Delete this function
// once the question above is answered; it isn't part of the real feature.
//
// Safe to run: uses a made-up order reference and a token 10 KES test
// amount, and posts server-to-server rather than through a real guest's
// browser, so nothing about a real booking is touched.

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

const AUTH_BASE = "https://uat.finserve.africa";
const PGW_BASE = "https://v3-uat.jengapgw.io";

Deno.serve(async (_req) => {
  const consumerKey = Deno.env.get("JENGA_SANDBOX_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("JENGA_SANDBOX_CONSUMER_SECRET");
  const merchantCode = Deno.env.get("JENGA_SANDBOX_MERCHANT_CODE");
  const privateKeyPem = Deno.env.get("JENGA_SANDBOX_PRIVATE_KEY");

  if (!consumerKey || !consumerSecret || !merchantCode || !privateKeyPem) {
    return json({ step: "config", error: "Missing JENGA_SANDBOX_ secrets." }, 501);
  }

  // Step 1: the exact same authenticate/merchant call mpesa-initiate uses.
  let accessToken: string;
  try {
    const authRes = await fetch(`${AUTH_BASE}/authentication/api/v3/authenticate/merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": consumerKey },
      body: JSON.stringify({ merchantCode, consumerSecret }),
    });
    const authBody = await authRes.text();
    if (!authRes.ok) {
      return json(
        { step: "authenticate", ok: false, status: authRes.status, body: authBody.slice(0, 1000) },
        200,
      );
    }
    accessToken = JSON.parse(authBody).accessToken;
    if (!accessToken) {
      return json({ step: "authenticate", ok: false, note: "no accessToken in response", body: authBody.slice(0, 1000) }, 200);
    }
  } catch (err) {
    return json({ step: "authenticate", ok: false, error: String(err) }, 200);
  }

  // Step 2: build a minimal, harmless PGW checkout request using that same
  // token, and see how Jenga's own server responds.
  const orderReference = `TST${Date.now().toString().slice(-9)}`; // >= 8 alphanumeric chars
  const currency = "KES";
  const orderAmount = "10.00";
  const callbackUrl = "https://www.pamhokhomes.com/";

  const signature = await signJenga(
    `${merchantCode}${orderReference}${currency}${orderAmount}${callbackUrl}`,
    privateKeyPem,
  );

  const form = new URLSearchParams({
    token: accessToken,
    merchantCode,
    currency,
    orderAmount,
    orderReference,
    productType: "Service",
    productDescription: "Pamhok Homes sandbox connectivity test",
    paymentTimeLimit: "15mins",
    customerFirstName: "Test",
    customerLastName: "Guest",
    customerEmail: "test@example.com",
    customerPhone: "254700000000",
    customerAddress: "Nairobi",
    customerPostalCodeZip: "00100",
    countryCode: "KE",
    callbackUrl,
    signature,
  });

  try {
    const pgwRes = await fetch(`${PGW_BASE}/processPayment`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      redirect: "manual", // a real browser would follow this to Jenga's hosted page — we just want to see the first response
    });
    const pgwBody = await pgwRes.text();
    return json(
      {
        step: "pgw-checkout",
        authOk: true,
        pgwStatus: pgwRes.status,
        pgwStatusText: pgwRes.statusText,
        pgwLocation: pgwRes.headers.get("location"),
        pgwContentType: pgwRes.headers.get("content-type"),
        pgwBodySnippet: pgwBody.slice(0, 1500),
        orderReference,
      },
      200,
    );
  } catch (err) {
    return json({ step: "pgw-checkout", authOk: true, error: String(err) }, 200);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
