// Supabase Edge Function: triggers an M-Pesa STK Push via Equity's Jenga API
// (account-based settlement — funds land directly in the Equity account
// given by JENGA_ACCOUNT_NUMBER, no separate payout step needed).
//
// Replaces the earlier Safaricom Daraja integration (removed at the owner's
// request — they're settling into an Equity account via Jenga instead).
//
// BEFORE THIS CAN WORK AT ALL, you need:
//   1. An RSA key pair, with the PUBLIC key uploaded to your Jenga/Equity
//      developer dashboard:
//        openssl genrsa -out private_key.pem 2048
//        openssl rsa -in private_key.pem -pubout -out public_key.pem
//        openssl pkcs8 -topk8 -nocrypt -in private_key.pem -out private_pkcs8.pem
//      Upload public_key.pem on the Jenga dashboard; set private_pkcs8.pem's
//      contents as the JENGA_PRIVATE_KEY secret below (NOT the CONSUMER_KEY —
//      that's a different credential).
//   2. Deploy + set secrets once Supabase tool/CLI access is available:
//        supabase functions deploy mpesa-initiate
//        supabase functions deploy mpesa-callback --no-verify-jwt
//        supabase secrets set JENGA_CONSUMER_KEY=... JENGA_CONSUMER_SECRET=...
//          JENGA_ACCOUNT_NUMBER=... JENGA_ENV=sandbox \
//          JENGA_PRIVATE_KEY="$(cat private_pkcs8.pem)"
//
// ⚠️ UNCONFIRMED AGAINST A LIVE SANDBOX CALL — unlike the Daraja integration
// this replaces (verified against Safaricom's real sandbox before being
// trusted), none of this has been exercised against Jenga's sandbox yet.
// Built from Jenga/Finserve's own public docs, which are genuinely
// inconsistent across pages for this API generation. Test a real STK push
// in sandbox before taking a live booking through this:
//   - The token endpoint below is documented as needing merchantCode +
//     consumerSecret + an Api-Key header — THREE values. This code guesses
//     JENGA_ACCOUNT_NUMBER -> merchantCode and JENGA_CONSUMER_KEY -> the
//     Api-Key header, since that's the only mapping that uses everything
//     you gave me. Verify against your own Jenga onboarding docs/dashboard,
//     not just this comment — a wrong mapping fails at the auth step.
//   - The Signature header (RSA-SHA256 over
//     accountNumber+ref+mobileNumber+telco+amount+currency, per Jenga's
//     API-explorer page for this exact STK/USSD-push endpoint) isn't
//     mentioned in Jenga's general auth guide, which may mean it only
//     applies to money-movement endpoints like this one — kept here, but
//     confirm the actual sandbox response before trusting it.
//   - Which field in the STK response (`reference` vs `transactionId`)
//     matches the callback's `transactionReference` is also unconfirmed —
//     see mpesa-callback/index.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { signJenga } from "../_shared/jenga.ts";

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
    const { token, phone, termsAccepted } = await req.json();

    if (!token || !phone) {
      return new Response(JSON.stringify({ error: "Missing token or phone." }), {
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
    const accountNumber = Deno.env.get("JENGA_ACCOUNT_NUMBER");
    const privateKeyPem = Deno.env.get("JENGA_PRIVATE_KEY");
    const jengaEnv = Deno.env.get("JENGA_ENV") ?? "sandbox";

    if (!consumerKey || !consumerSecret || !accountNumber || !privateKeyPem) {
      return new Response(
        JSON.stringify({ error: "Payment method not yet configured.", configured: false }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, total_amount, payment_status, id_verification_status, terms_accepted_at")
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

    const base = finserveBase(jengaEnv);

    // Best-guess credential mapping — see the file-level comment above.
    const authRes = await fetch(`${base}/authentication/api/v3/authenticate/merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": consumerKey },
      body: JSON.stringify({ merchantCode: accountNumber, consumerSecret }),
    });
    if (!authRes.ok) throw new Error("Could not authenticate with Jenga.");
    const { accessToken } = await authRes.json();

    // Jenga's payment.ref is capped at 6 alphanumeric characters.
    const ref = booking.id.replace(/-/g, "").slice(0, 6).toUpperCase();
    const amount = Math.round(booking.total_amount).toFixed(2);
    const today = new Date().toISOString().slice(0, 10);
    const callbackUrl =
      Deno.env.get("JENGA_CALLBACK_URL") ??
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

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

    // Track the transaction reference so the callback can find this booking —
    // see the file-level comment for why `reference` (not `transactionId`)
    // is the unconfirmed guess here.
    await supabase
      .from("bookings")
      .update({ payment_method: "mpesa", payment_reference: stkData.reference ?? ref })
      .eq("id", booking.id);

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
