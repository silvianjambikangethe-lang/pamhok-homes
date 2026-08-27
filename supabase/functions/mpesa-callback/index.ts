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
//
// Extension-hold handling below mirrors src/lib/extension-hold.ts's
// resolvePendingExtensionAfterPayment() on the Next.js side — duplicated
// here (not imported) because this Deno function has no access to that
// Node module tree, same reason _shared/email.ts duplicates
// src/lib/email.ts's templates instead of importing them. Keep both in
// sync if the hold rules or email copy ever change.
//
// IMPORTANT: Supabase Edge Functions are a separate deployment target
// from Vercel — a `git push` alone does NOT update the live function.
// After changing this file, redeploy it explicitly (the Supabase MCP
// tool's deploy_edge_function, or `supabase functions deploy
// mpesa-callback --no-verify-jwt`). This file drifted from what was
// actually live for a while because an earlier PR that added the
// sendPaymentSucceededEmail call below was merged to git but never
// redeployed — don't repeat that.

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPaymentSucceededEmail } from "../_shared/email.ts";

const EXTENSION_HOLD_HOURS = 3;

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
      .select(
        "id, paid_at, room_id, check_out, total_amount, pending_extension_check_out, pending_extension_nights, pending_extension_amount, pending_extension_requested_at",
      )
      .eq("payment_reference", reference)
      .maybeSingle();

    if (!booking) {
      // Acknowledge anyway — assume Jenga retries on failure the way Daraja did.
      return new Response(JSON.stringify({ received: true }));
    }

    if (payload.status === true && payload.code === 0) {
      const wasAlreadyPaid = booking.paid_at != null;

      await supabase
        .from("bookings")
        .update({
          payment_status: "Paid",
          payment_reference: payload.telcoReference ? String(payload.telcoReference) : reference,
          paid_at: new Date().toISOString(),
        })
        .eq("id", booking.id);

      // A stay extension only takes effect once its payment actually
      // clears — apply the held pending_extension_check_out now, after
      // re-checking the hold hasn't expired and nobody else took the
      // dates in the meantime. No-op if there's no pending extension.
      let extensionReverted = false;
      if (booking.pending_extension_check_out) {
        const requestedAt = booking.pending_extension_requested_at
          ? new Date(booking.pending_extension_requested_at).getTime()
          : 0;
        const expired = Date.now() - requestedAt > EXTENSION_HOLD_HOURS * 60 * 60 * 1000;

        let conflict = false;
        if (!expired && booking.room_id) {
          const { data: conflicts } = await supabase
            .from("bookings")
            .select("id")
            .eq("room_id", booking.room_id)
            .neq("id", booking.id)
            .in("booking_status", ["Confirmed", "Blocked", "Pending Verification"])
            .lt("check_in", booking.pending_extension_check_out)
            .gt("check_out", booking.check_out);
          conflict = !!conflicts && conflicts.length > 0;
        }

        await supabase
          .from("guest_requests")
          .update({ status: "Closed" })
          .eq("booking_id", booking.id)
          .eq("request_type", "extension")
          .eq("status", "Open");

        if (expired || conflict) {
          extensionReverted = true;
          await supabase
            .from("bookings")
            .update({
              total_amount: booking.total_amount - (booking.pending_extension_amount ?? 0),
              pending_extension_check_out: null,
              pending_extension_nights: null,
              pending_extension_amount: null,
              pending_extension_requested_at: null,
            })
            .eq("id", booking.id);

          await supabase.from("guest_requests").insert({
            booking_id: booking.id,
            request_type: "extension",
            message: expired
              ? "Guest paid via M-Pesa, but their extension hold had already expired (3hr window passed) before payment cleared — extra nights were NOT granted, amount adjusted back down. Check whether a refund of the difference is owed."
              : "Guest paid via M-Pesa, but the extra nights were booked by someone else in the meantime — extra nights were NOT granted, amount adjusted back down. Check whether a refund of the difference is owed.",
            status: "Open",
          });
        } else {
          await supabase
            .from("bookings")
            .update({
              check_out: booking.pending_extension_check_out,
              pending_extension_check_out: null,
              pending_extension_nights: null,
              pending_extension_amount: null,
              pending_extension_requested_at: null,
            })
            .eq("id", booking.id);

          await supabase.from("guest_requests").insert({
            booking_id: booking.id,
            request_type: "extension",
            message: `Extension confirmed — M-Pesa payment received for ${booking.pending_extension_nights} extra night${booking.pending_extension_nights === 1 ? "" : "s"}. Stay now extends to ${booking.pending_extension_check_out}.`,
            status: "Open",
          });
        }
      }

      // If the hold expired or lost the dates right as payment landed,
      // neither the "booking confirmed" nor "extension confirmed" email
      // is true — admin was already notified above and needs to sort out
      // a possible refund before the guest hears anything.
      if (!extensionReverted) {
        await sendPaymentSucceededEmail(supabase, booking.id, wasAlreadyPaid);
      }
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
