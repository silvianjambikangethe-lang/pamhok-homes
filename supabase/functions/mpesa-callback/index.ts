// Supabase Edge Function: receives Jenga's STK/USSD push callback and marks
// the matching booking Paid/Failed.
// Deploy with: supabase functions deploy mpesa-callback --no-verify-jwt
// (Jenga/Finserve cannot send a Supabase auth header, so JWT verification
// must be disabled for this function specifically.)
//
// Replaces the earlier Safaricom Daraja callback handler — see
// mpesa-initiate/index.ts for the full Jenga integration status/caveats.
// Specific to this file:
//   - Jenga's docs describe the callback body's `code` field as "0-7
//     representing transaction states" without listing what each number
//     means. This treats `status === true && code === 0` as success and
//     everything else as failed — watch your Edge Function logs for the
//     actual values Jenga sends in sandbox and adjust if code 0 isn't it.
//   - Which field matches mpesa-initiate's stored payment_reference is also
//     unconfirmed — this assumes `transactionReference` by name.
//   - What Jenga expects back from this endpoint isn't documented (Daraja
//     expected {ResultCode, ResultDesc}; Jenga's docs don't say). Returns a
//     generic 200 ack — if Jenga retries indefinitely in sandbox, it likely
//     wants a specific body/shape back instead.
//   - This callback is NOT signature-verified — anyone who guesses a valid
//     transaction reference could spoof a "Paid" callback. Check whether
//     Jenga signs its callbacks (their docs don't mention it) and verify
//     that signature here before this goes anywhere near production.

import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const reference = payload?.transactionReference as string | undefined;

    if (!reference) {
      return new Response(JSON.stringify({ received: true }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (!booking) {
      // Acknowledge anyway — assume Jenga retries on failure the way Daraja did.
      return new Response(JSON.stringify({ received: true }));
    }

    if (payload.status === true && payload.code === 0) {
      await supabase
        .from("bookings")
        .update({
          payment_status: "Paid",
          payment_reference: payload.telcoReference ? String(payload.telcoReference) : reference,
          paid_at: new Date().toISOString(),
        })
        .eq("id", booking.id);
    } else {
      await supabase
        .from("bookings")
        .update({ payment_status: "Failed" })
        .eq("id", booking.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ received: true }), { status: 500 });
  }
});
