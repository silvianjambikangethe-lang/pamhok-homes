// Supabase Edge Function: receives the Daraja STK Push result callback
// and marks the matching booking Paid/Failed.
// Deploy with: supabase functions deploy mpesa-callback --no-verify-jwt
// (Safaricom cannot send a Supabase auth header, so JWT verification must
// be disabled for this function specifically.)

import { createClient } from "npm:@supabase/supabase-js@2";

interface CallbackItem {
  Name: string;
  Value?: string | number;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const stkCallback = payload?.Body?.stkCallback;

    if (!stkCallback) {
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Invalid payload" }), {
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const checkoutRequestId = stkCallback.CheckoutRequestID as string;

    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("payment_reference", checkoutRequestId)
      .maybeSingle();

    if (!booking) {
      // Acknowledge anyway — Safaricom retries on non-200 responses.
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }));
    }

    if (stkCallback.ResultCode === 0) {
      const items: CallbackItem[] = stkCallback.CallbackMetadata?.Item ?? [];
      const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;

      await supabase
        .from("bookings")
        .update({
          payment_status: "Paid",
          payment_reference: receipt ? String(receipt) : checkoutRequestId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", booking.id);
    } else {
      await supabase
        .from("bookings")
        .update({ payment_status: "Failed" })
        .eq("id", booking.id);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Error" }), { status: 500 });
  }
});
