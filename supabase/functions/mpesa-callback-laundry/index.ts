// Supabase Edge Function: receives Jenga's STK/USSD push callback for a
// LAUNDRY charge and marks the matching guest_requests row Paid/Failed.
// Deploy with: supabase functions deploy mpesa-callback-laundry --no-verify-jwt
// (Jenga/Finserve cannot send a Supabase auth header.)
//
// Separate from mpesa-callback (the booking-payment one) on purpose —
// see mpesa-initiate-laundry/index.ts for why. Same unconfirmed-status-
// code and no-signature-verification caveats documented in
// mpesa-callback/index.ts apply here too; this hasn't been exercised
// against a real callback yet either.

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

    const { data: laundryRequest } = await supabase
      .from("guest_requests")
      .select("id")
      .eq("laundry_payment_reference", reference)
      .eq("request_type", "laundry")
      .maybeSingle();

    if (!laundryRequest) {
      // Acknowledge anyway — assume Jenga retries on failure the way it
      // does for the booking-payment callback.
      return new Response(JSON.stringify({ received: true }));
    }

    if (payload.status === true && payload.code === 0) {
      await supabase
        .from("guest_requests")
        .update({
          laundry_payment_status: "Paid",
          laundry_payment_reference: payload.telcoReference
            ? String(payload.telcoReference)
            : reference,
          laundry_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", laundryRequest.id);
    } else {
      await supabase
        .from("guest_requests")
        .update({ laundry_payment_status: "Failed", updated_at: new Date().toISOString() })
        .eq("id", laundryRequest.id);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ received: true }), { status: 500 });
  }
});
