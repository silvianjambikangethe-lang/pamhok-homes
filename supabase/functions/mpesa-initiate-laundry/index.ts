// Supabase Edge Function: triggers an M-Pesa STK Push via Equity's Jenga
// API for a LAUNDRY charge specifically — a separate function from
// mpesa-initiate (the booking-payment one) on purpose, so this new,
// less-proven code path can never risk the existing booking-payment
// integration. Same Jenga account/credentials, same signing helper, same
// unconfirmed-end-to-end caveats documented in mpesa-initiate/index.ts —
// this hasn't had its own real sandbox run yet either.
//
// Writes to guest_requests.laundry_* columns, never bookings.payment_* —
// a booking's stay payment and a laundry charge must stay fully
// independent, since both can be in flight on the same booking at once.
//
// corsHeaders/signJenga are inlined here rather than imported from
// ../_shared — the deploy tool used for this project couldn't resolve
// that relative import across function folders (mpesa-initiate/
// mpesa-callback get away with it via the Supabase CLI's own bundler,
// which this tool doesn't share), and duplicating ~40 lines is a smaller
// risk than a function whose deployed bundle silently doesn't match what
// git shows. Keep in sync with _shared/jenga.ts if the signing scheme
// ever changes.

import { createClient } from "npm:@supabase/supabase-js@2";

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

function finserveBase(env: string) {
  return env === "production"
    ? "https://api.finserve.africa"
    : "https://uat.finserve.africa";
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, requestId, phone } = await req.json();

    if (
      !token ||
      !requestId ||
      !phone ||
      typeof token !== "string" ||
      typeof requestId !== "string" ||
      token.length > 200 ||
      requestId.length > 100 ||
      String(phone).length > 20
    ) {
      return new Response(JSON.stringify({ error: "Missing token, requestId, or phone." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = normalizePhone(String(phone));
    if (!normalizedPhone) {
      return new Response(
        JSON.stringify({ error: "Enter a valid Safaricom number, e.g. 07XXXXXXXX." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const consumerKey = Deno.env.get("JENGA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("JENGA_CONSUMER_SECRET");
    const merchantCode = Deno.env.get("JENGA_MERCHANT_CODE");
    const accountNumber = Deno.env.get("JENGA_ACCOUNT_NUMBER");
    const privateKeyPem = Deno.env.get("JENGA_PRIVATE_KEY");
    const jengaEnv = Deno.env.get("JENGA_ENV") ?? "sandbox";

    if (!consumerKey || !consumerSecret || !merchantCode || !accountNumber || !privateKeyPem) {
      return new Response(
        JSON.stringify({ error: "Payment method not yet configured.", configured: false }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("access_token", token)
      .maybeSingle();

    if (!booking) {
      return new Response(JSON.stringify({ error: "Booking not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: laundryRequest, error: laundryError } = await supabase
      .from("guest_requests")
      .select("id, laundry_amount, laundry_payment_status")
      .eq("id", requestId)
      .eq("booking_id", booking.id)
      .eq("request_type", "laundry")
      .maybeSingle();

    if (laundryError || !laundryRequest || !laundryRequest.laundry_amount) {
      return new Response(JSON.stringify({ error: "Laundry request not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (laundryRequest.laundry_payment_status === "Paid") {
      return new Response(JSON.stringify({ error: "This laundry charge is already paid." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = finserveBase(jengaEnv);

    const authRes = await fetch(`${base}/authentication/api/v3/authenticate/merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": consumerKey },
      body: JSON.stringify({ merchantCode, consumerSecret }),
    });
    if (!authRes.ok) throw new Error("Could not authenticate with Jenga.");
    const { accessToken } = await authRes.json();

    // Jenga's payment.ref is capped at 6 alphanumeric characters — same
    // truncated-uuid approach as mpesa-initiate, just off the request's
    // own id instead of the booking's.
    const ref = laundryRequest.id.replace(/-/g, "").slice(0, 6).toUpperCase();
    const amount = Math.round(laundryRequest.laundry_amount).toFixed(2);
    const today = new Date().toISOString().slice(0, 10);
    const callbackUrl =
      Deno.env.get("JENGA_LAUNDRY_CALLBACK_URL") ??
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback-laundry`;

    const signature = await signJenga(
      `${accountNumber}${ref}${normalizedPhone}Safaricom${amount}KES`,
      privateKeyPem,
    );

    const stkRes = await fetch(`${base}/v3-apis/payment-api/v3.0/stkussdpush/initiate`, {
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
          mobileNumber: normalizedPhone,
          date: today,
          callBackUrl: callbackUrl,
          pushType: "STK",
        },
      }),
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.status !== true) {
      return new Response(
        JSON.stringify({ error: stkData.message ?? "Could not start M-Pesa payment." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase
      .from("guest_requests")
      .update({
        laundry_payment_method: "mpesa",
        laundry_payment_reference: stkData.reference ?? ref,
      })
      .eq("id", requestId);

    return new Response(
      JSON.stringify({ ok: true, message: "Check your phone to complete payment." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
