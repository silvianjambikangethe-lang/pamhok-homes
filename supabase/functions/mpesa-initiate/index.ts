// Supabase Edge Function: triggers an M-Pesa STK Push for a booking.
// Deploy with: supabase functions deploy mpesa-initiate
// Requires secrets (supabase secrets set ...):
//   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY,
//   MPESA_ENV ("sandbox" | "production"), MPESA_CALLBACK_URL (optional —
//   defaults to this project's mpesa-callback function URL)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function daraja(env: string) {
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  return null;
}

function darajaTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const mpesaEnv = Deno.env.get("MPESA_ENV") ?? "sandbox";

    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
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

    const base = daraja(mpesaEnv);

    const authRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
    });
    if (!authRes.ok) throw new Error("Could not authenticate with Daraja.");
    const { access_token: darajaToken } = await authRes.json();

    const timestamp = darajaTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const callbackUrl =
      Deno.env.get("MPESA_CALLBACK_URL") ??
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

    const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${darajaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(booking.total_amount),
        PartyA: normalizedPhone,
        PartyB: shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: `Pamhok-${booking.id.slice(0, 8)}`,
        TransactionDesc: "Pamhok Homes booking",
      }),
    });

    const stkData = await stkRes.json();

    if (!stkRes.ok || stkData.ResponseCode !== "0") {
      return new Response(
        JSON.stringify({ error: stkData.errorMessage ?? "Could not start M-Pesa payment." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Track the CheckoutRequestID so the callback can find this booking —
    // overwritten with the real M-Pesa receipt number once payment succeeds.
    await supabase
      .from("bookings")
      .update({ payment_method: "mpesa", payment_reference: stkData.CheckoutRequestID })
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
