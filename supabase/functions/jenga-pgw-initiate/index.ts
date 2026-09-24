// Supabase Edge Function: starts a Jenga PGW hosted-checkout payment for a
// booking, or (when `requestId` is passed) for a laundry charge. The guest is
// redirected to Jenga's hosted page where they pick M-Pesa / Equitel mobile
// money or a card — the merchant is subscribed to PGW Mobile Money + Card,
// NOT the raw STK/USSD Push API, so this is the only guest payment path.
//
// Environment: JENGA_ENV=production uses the live JENGA_* secrets and the
// live hosts (api.finserve.africa / v3.jengapgw.io); anything else uses the
// JENGA_SANDBOX_* secrets and the UAT hosts. Which one was used is only
// logged, never returned to the browser.
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
        "id, room_id, check_in, check_out, paid_at, total_amount, payment_status, id_verification_status, terms_accepted_at, guest:guests(full_name, email, phone)",
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
      // A booking only takes its dates once it is PAID (see the
      // availability_only_paid_bookings migration), so before the first
      // payment re-check that nobody else has paid for them in the meantime.
      // Skipped once paid_at is set (e.g. paying for a stay extension), since
      // the booking's own nights are then in the availability view.
      if (!booking.paid_at && booking.room_id) {
        const { data: taken, error: takenError } = await supabase
          .from("availability_view")
          .select("room_id")
          .eq("room_id", booking.room_id)
          .lt("check_in", booking.check_out)
          .gt("check_out", booking.check_in)
          .limit(1);
        if (takenError) {
          console.error("availability re-check failed", takenError);
          return json({ error: "Could not start payment. Please try again." }, 500);
        }
        if (taken && taken.length > 0) {
          return json(
            { error: "Sorry, those dates were just booked by another guest. Please choose different dates." },
            409,
          );
        }
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
      return json({ error: "Could not start payment." }, 502);
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

    // The guest types their own details on Jenga's page (the cardholder name
    // has to match the card exactly, so pre-filled names caused mismatches).
    // Jenga lists these fields as required, so they are sent BLANK first; only
    // if Jenga refuses blanks do we fall back to the booking's own details.
    const postToPgw = (details: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      address: string;
      postalCode: string;
    }) =>
      fetch(`${PGW_BASE}/processPayment`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: accessToken,
          merchantCode,
          currency,
          orderAmount,
          orderReference,
          productType: "Service",
          productDescription: description,
          paymentTimeLimit: "15mins",
          customerFirstName: details.firstName,
          customerLastName: details.lastName,
          customerEmail: details.email,
          customerPhone: details.phone,
          customerAddress: details.address,
          customerPostalCodeZip: details.postalCode,
          countryCode: "KE",
          callbackUrl,
          signature,
        }).toString(),
        redirect: "manual",
      });

    let pgwRes = await postToPgw({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      postalCode: "",
    });

    if (pgwRes.status !== 302 || !pgwRes.headers.get("location")) {
      console.error("Jenga rejected blank customer details; retrying with the booking's details", pgwRes.status);
      pgwRes = await postToPgw({
        firstName,
        lastName,
        email: guest?.email || "guest@pamhokhomes.com",
        phone: guest?.phone || "254700000000",
        address: "Nairobi",
        postalCode: "00100",
      });
    }

    const redirectUrl = pgwRes.headers.get("location");
    if (pgwRes.status !== 302 || !redirectUrl) {
      const pgwBody = await pgwRes.text().catch(() => "");
      console.error("Jenga PGW checkout failed", pgwRes.status, pgwBody.slice(0, 1000));
      return json({ error: "Could not start payment." }, 502);
    }

    // Every attempt is remembered so a guest who starts a second attempt can
    // still complete the first (the callback resolves references here). A
    // failure to record only degrades to the payment_reference fallback below.
    const { error: attemptError } = await supabase.from("payment_attempts").insert({
      reference: orderReference,
      booking_id: requestId ? null : booking.id,
      request_id: requestId ?? null,
    });
    if (attemptError) console.error("payment_attempts insert failed", attemptError);

    // The method (mpesa vs card) isn't known until the guest picks a channel
    // on Jenga's page — the callback fills it in from Jenga's channel field.
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

    return json({ ok: true, redirectUrl });
  } catch (err) {
    console.error("jenga-pgw-initiate failed", err);
    return json({ error: "Could not start payment. Please try again." }, 500);
  }
});
