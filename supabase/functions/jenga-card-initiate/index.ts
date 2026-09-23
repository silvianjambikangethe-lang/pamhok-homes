// Supabase Edge Function: starts a Jenga PGW Checkout card payment for a
// booking. Mirrors mpesa-initiate/index.ts's validation and Jenga-signing
// pattern, but calls Jenga's hosted-checkout product (PGW) instead of the
// STK/USSD push — the guest is redirected to a Jenga-hosted page to type
// their card details, which never touch our server.
//
// SANDBOX ONLY FOR NOW: reads the JENGA_SANDBOX_* secrets and always calls
// Jenga's uat.finserve.africa / v3-uat.jengapgw.io hosts, deliberately
// ignoring JENGA_ENV — the live JENGA_* secrets (used by mpesa-initiate)
// are NOT touched by this function. Do not point this at production hosts
// until the settlement account is linked and the owner says so.
//
// Confirmed against a real sandbox call (2026-09-22, via the throwaway
// jenga-pgw-sandbox-test function): the SAME bearer token/auth flow used
// for M-Pesa is accepted by PGW — Jenga responded 302 with a `location`
// pointing at a real v3-uat-checkout.jengapgw.io session page.
//
// Signature payload for PGW differs from STK's: it's
// merchantCode+orderReference+currency+orderAmount+callbackUrl (no phone/
// telco/account-number, unlike the STK push's signature in mpesa-initiate).

import { createClient } from "npm:@supabase/supabase-js@2";

// Inlined _shared/cors.ts and _shared/jenga.ts — the deploy path used for
// this function doesn't resolve relative shared imports (same reason
// mpesa-initiate-laundry/index.ts inlines them).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, termsAccepted } = await req.json();

    if (!token || typeof token !== "string" || token.length > 200) {
      return new Response(JSON.stringify({ error: "Missing token." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const consumerKey = Deno.env.get("JENGA_SANDBOX_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("JENGA_SANDBOX_CONSUMER_SECRET");
    const merchantCode = Deno.env.get("JENGA_SANDBOX_MERCHANT_CODE");
    const privateKeyPem = Deno.env.get("JENGA_SANDBOX_PRIVATE_KEY");

    if (!consumerKey || !consumerSecret || !merchantCode || !privateKeyPem) {
      return new Response(
        JSON.stringify({ error: "Card payment not yet configured.", configured: false }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, total_amount, payment_status, id_verification_status, terms_accepted_at, guest:guests(full_name, email, phone)",
      )
      .eq("access_token", token)
      .maybeSingle();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.payment_status === "Paid") {
      return new Response(JSON.stringify({ error: "This booking is already paid." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (booking.id_verification_status !== "Verified") {
      return new Response(
        JSON.stringify({ error: "Please complete ID verification before paying." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (termsAccepted !== true) {
      return new Response(
        JSON.stringify({ error: "Please accept the Terms & Conditions and Privacy Policy before paying." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!booking.terms_accepted_at) {
      await supabase
        .from("bookings")
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq("id", booking.id);
    }

    const authRes = await fetch(`${AUTH_BASE}/authentication/api/v3/authenticate/merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": consumerKey },
      body: JSON.stringify({ merchantCode, consumerSecret }),
    });
    if (!authRes.ok) {
      const authBody = await authRes.text().catch(() => "");
      console.error("Jenga sandbox auth failed", authRes.status, authBody);
      throw new Error("Could not authenticate with Jenga.");
    }
    const { accessToken } = await authRes.json();

    // PGW's orderReference must be >= 8 alphanumeric characters (unlike
    // STK's 6-char-capped ref) — derive it from the booking id so the
    // callback can look the booking back up by payment_reference.
    const orderReference = `PGW${booking.id.replace(/-/g, "").slice(0, 9).toUpperCase()}`;
    const currency = "KES";
    const orderAmount = Math.round(booking.total_amount).toFixed(2);
    const callbackUrl =
      Deno.env.get("JENGA_CARD_CALLBACK_URL") ??
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/jenga-card-callback`;

    const signature = await signJenga(
      `${merchantCode}${orderReference}${currency}${orderAmount}${callbackUrl}`,
      privateKeyPem,
    );

    // Jenga's checkout form rejects a last name containing spaces or
    // special characters (confirmed against a real sandbox test,
    // 2026-09-22) — a two-word surname like "Van Der Berg" would otherwise
    // be silently rejected on Jenga's own page. Strip to letters only and
    // join any remaining name parts with no separator.
    const guest = Array.isArray(booking.guest) ? booking.guest[0] : booking.guest;
    const nameParts = (guest?.full_name ?? "Guest").trim().split(/\s+/);
    const sanitizeName = (s: string) => s.replace(/[^A-Za-z]/g, "") || "Guest";
    const firstName = sanitizeName(nameParts[0] ?? "Guest");
    const lastName = sanitizeName(nameParts.slice(1).join("")) || "Guest";

    const form = new URLSearchParams({
      token: accessToken,
      merchantCode,
      currency,
      orderAmount,
      orderReference,
      productType: "Service",
      productDescription: "Pamhok Homes booking payment",
      paymentTimeLimit: "15mins",
      customerFirstName: firstName || "Guest",
      customerLastName: lastName,
      customerEmail: guest?.email || "guest@pamhokhomes.com",
      customerPhone: guest?.phone || "254700000000",
      customerAddress: "Nairobi",
      customerPostalCodeZip: "00100",
      countryCode: "KE",
      callbackUrl,
      signature,
    });

    const pgwRes = await fetch(`${PGW_BASE}/processPayment`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      redirect: "manual",
    });

    const redirectUrl = pgwRes.headers.get("location");
    if (pgwRes.status !== 302 || !redirectUrl) {
      const pgwBody = await pgwRes.text().catch(() => "");
      console.error("Jenga PGW checkout failed", pgwRes.status, pgwBody.slice(0, 1000));
      return new Response(JSON.stringify({ error: "Could not start card payment." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("bookings")
      .update({ payment_method: "card", payment_reference: orderReference })
      .eq("id", booking.id);

    return new Response(JSON.stringify({ ok: true, redirectUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
