// Supabase Edge Function: starts a Jenga PGW hosted-checkout payment for a
// booking, or (when `requestId` is passed) for a laundry charge. The guest is
// redirected to Jenga's hosted page where they pick M-Pesa / Equitel mobile
// money or a card — the merchant is subscribed to PGW Mobile Money + Card,
// NOT the raw STK/USSD Push API, so this is the only guest payment path.
//
// Environment: JENGA_ENV=production uses the live JENGA_* secrets and the
// live hosts (api.finserve.africa / v3.jengapgw.io); anything else uses the
// JENGA_SANDBOX_* secrets and the UAT hosts. The response includes `env` so
// a test call shows which one was actually used.
//
// Signature payload: merchantCode+orderReference+currency+orderAmount+callbackUrl.
//
// The orderReference is random per attempt (not derived from the booking id):
// jenga-pgw-callback is an unauthenticated GET that can't verify Jenga's hash
// (formula unpublished), so an unguessable reference is what stops a guest
// forging `status=paid` for their own booking.
//
// Inlines the CORS/signing helpers because the MCP deploy path doesn't
// resolve relative shared imports.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

async function signJenga(payload: string, privateKeyPem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(payload),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// 12 random uppercase alphanumerics (~62 bits) after a 3-letter prefix.
function randomReference(prefix: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return prefix + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const isProduction = Deno.env.get("JENGA_ENV") === "production";
const AUTH_BASE = isProduction ? "https://api.finserve.africa" : "https://uat.finserve.africa";
const PGW_BASE = isProduction ? "https://v3.jengapgw.io" : "https://v3-uat.jengapgw.io";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, requestId, termsAccepted } = await req.json();

    if (!token || typeof token !== "string" || token.length > 200) {
      return json({ error: "Missing token." }, 400);
    }
    if (requestId !== undefined && (typeof requestId !== "string" || requestId.length > 100)) {
      return json({ error: "Invalid requestId." }, 400);
    }

    const prefix = isProduction ? "JENGA_" : "JENGA_SANDBOX_";
    const consumerKey = Deno.env.get(`${prefix}CONSUMER_KEY`);
    const consumerSecret = Deno.env.get(`${prefix}CONSUMER_SECRET`);
    const merchantCode = Deno.env.get(`${prefix}MERCHANT_CODE`);
    const privateKeyPem = Deno.env.get(`${prefix}PRIVATE_KEY`);

    if (!consumerKey || !consumerSecret || !merchantCode || !privateKeyPem) {
      return json({ error: "Payment not yet configured.", configured: false }, 501);
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
      return json({ error: "Booking not found." }, 404);
    }

    let amountKes: number;
    let orderReference: string;
    let description: string;

    if (requestId) {
      // Laundry charge: priced by the host after the request is made, and only
      // payable once the booking's own payment gate has passed (same as the
      // old mpesa-initiate-laundry, which did not re-check ID/terms).
      const { data: laundry, error: laundryError } = await supabase
        .from("guest_requests")
        .select("id, laundry_amount, laundry_payment_status")
        .eq("id", requestId)
        .eq("booking_id", booking.id)
        .eq("request_type", "laundry")
        .maybeSingle();

      if (laundryError || !laundry || !laundry.laundry_amount) {
        return json({ error: "Laundry request not found." }, 404);
      }
      if (laundry.laundry_payment_status === "Paid") {
        return json({ error: "This laundry charge is already paid." }, 409);
      }
      amountKes = Number(laundry.laundry_amount);
      orderReference = randomReference("LND");
      description = "Pamhok Homes laundry payment";
    } else {
      if (booking.payment_status === "Paid") {
        return json({ error: "This booking is already paid." }, 409);
      }
      if (booking.id_verification_status !== "Verified") {
        return json({ error: "Please complete ID verification before paying." }, 403);
      }
      if (termsAccepted !== true) {
        return json(
          { error: "Please accept the Terms & Conditions and Privacy Policy before paying." },
          403,
        );
      }
      if (!booking.terms_accepted_at) {
        await supabase
          .from("bookings")
          .update({ terms_accepted_at: new Date().toISOString() })
          .eq("id", booking.id);
      }
      amountKes = Number(booking.total_amount);
      orderReference = randomReference("PGW");
      description = "Pamhok Homes booking payment";
    }

    const authRes = await fetch(`${AUTH_BASE}/authentication/api/v3/authenticate/merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": consumerKey },
      body: JSON.stringify({ merchantCode, consumerSecret }),
    });
    if (!authRes.ok) {
      const authBody = await authRes.text().catch(() => "");
      console.error("Jenga auth failed", isProduction ? "live" : "sandbox", authRes.status, authBody);
      return json({ error: "Could not authenticate with Jenga.", env: isProduction ? "live" : "sandbox" }, 502);
    }
    const { accessToken } = await authRes.json();

    const currency = "KES";
    const orderAmount = Math.round(amountKes).toFixed(2);
    const callbackUrl =
      Deno.env.get("JENGA_PGW_CALLBACK_URL") ??
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/jenga-pgw-callback`;

    const signature = await signJenga(
      `${merchantCode}${orderReference}${currency}${orderAmount}${callbackUrl}`,
      privateKeyPem,
    );

    // Jenga's checkout form rejects last names with spaces/special characters.
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
      productDescription: description,
      paymentTimeLimit: "15mins",
      customerFirstName: firstName,
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
      return json(
        {
          error: "Could not start payment.",
          env: isProduction ? "live" : "sandbox",
          jengaStatus: pgwRes.status,
          jengaBody: pgwBody.slice(0, 500),
        },
        502,
      );
    }

    // The method (mpesa vs card) isn't known until the guest picks a channel
    // on Jenga's page — the callback fills it in from Jenga's `desc`.
    if (requestId) {
      await supabase
        .from("guest_requests")
        .update({ laundry_payment_reference: orderReference })
        .eq("id", requestId);
    } else {
      await supabase
        .from("bookings")
        .update({ payment_reference: orderReference })
        .eq("id", booking.id);
    }

    return json({ ok: true, redirectUrl, env: isProduction ? "live" : "sandbox" });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
