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
// Marking the booking paid and resolving any pending extension hold both
// happen inside the mark_booking_paid() Postgres function (see the
// guest_payment_rpc_functions migration) rather than as raw table writes
// here — a deliberate blast-radius reduction: this callback carries the
// full service-role key and is one of the least-trusted entry points in
// the app (see the "NOT signature-verified" note below), so the actual
// side effects live in a single, narrow, reviewed database function
// instead of being freely expressible from this file. mark_booking_paid
// mirrors src/lib/extension-hold.ts's resolvePendingExtensionAfterPayment()
// logic — keep both in sync if the hold rules ever change.
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

// Inlined from ../_shared/email.ts — the deploy path used for this
// function doesn't resolve relative shared imports (same reason
// jenga-card-callback/index.ts carries its own copy of this same
// function). Keep in sync with _shared/email.ts and src/lib/email.ts if
// the copy ever changes.
const SITE = {
  name: "Pamhok Homes",
  address: "Near Thika Road Mall (TRM), Nairobi, Kenya",
  phone: "+254 704 393 189",
  contactEmail: "hello@pamhokhomes.com",
};

function fromAddress(): string {
  return Deno.env.get("EMAIL_FROM_ADDRESS") ?? `${SITE.name} <onboarding@resend.dev>`;
}

function wrapper(bodyHtml: string): string {
  return `<div style="background:#FBF7F1; padding:32px 16px;">
    <style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Plus+Jakarta+Sans:wght@400;600&display=swap');</style>
    <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #2a2118; font-size: 15px; line-height: 1.6;">
      <h1 style="font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 22px; margin: 0 0 20px;">${SITE.name}</h1>
      ${bodyHtml}
      <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #EBDFC6; font-size: 13px; color: #8a7d6e;">
        ${SITE.address} · ${SITE.phone}
      </p>
    </div>
  </div>`;
}

function button(url: string, label: string): string {
  return `<p style="margin: 24px 0;">
    <a href="${url}" style="display:inline-block; background:#C4713C; color:#ffffff; padding:12px 28px; border-radius:999px; text-decoration:none; font-weight:600; font-size:14px;">${label}</a>
  </p>`;
}

// deno-lint-ignore no-explicit-any
async function sendPaymentSucceededEmail(
  supabase: any,
  bookingId: string,
  wasAlreadyPaid: boolean,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "check_in, check_out, total_amount, currency, booking_reference, access_token, guest:guests(full_name, email), room:rooms(name)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  const guest = booking?.guest as { full_name: string; email: string | null } | null;
  if (!booking || !guest?.email) return;

  const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://www.pamhokhomes.com";
  const portalUrl = `${siteUrl}/portal/${booking.access_token}`;
  const roomName = (booking.room as { name?: string } | null)?.name ?? "your room";
  const amountText = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: booking.currency,
    maximumFractionDigits: 0,
  }).format(booking.total_amount);

  const { subject, html } = wasAlreadyPaid
    ? {
        subject: `Stay extended — new checkout ${booking.check_out}`,
        html: wrapper(`
          <p>Hi ${guest.full_name},</p>
          <p>Your extension is confirmed! We've updated your stay in ${roomName}.</p>
          <ul style="padding-left: 18px;">
            <li><strong>New checkout date:</strong> ${booking.check_out}</li>
            <li><strong>Total confirmed for your stay:</strong> ${amountText}</li>
          </ul>
          ${button(portalUrl, "View my booking")}
        `),
      }
    : {
        subject: `Payment confirmed — ${roomName}, ${booking.check_in} to ${booking.check_out}`,
        html: wrapper(`
          <p>Hi ${guest.full_name},</p>
          <p>Your payment is confirmed and your stay is booked. Here's your summary:</p>
          <ul style="padding-left: 18px;">
            <li><strong>Room:</strong> ${roomName}</li>
            <li><strong>Check-in:</strong> ${booking.check_in}</li>
            <li><strong>Check-out:</strong> ${booking.check_out}</li>
            <li><strong>Paid:</strong> ${amountText}</li>
            ${booking.booking_reference ? `<li><strong>Reference:</strong> ${booking.booking_reference}</li>` : ""}
          </ul>
          <p>Your door code and WiFi details will be ready on your booking page once your ID is verified (if it isn't already):</p>
          ${button(portalUrl, "View my booking")}
        `),
      };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: guest.email,
        subject,
        html,
        reply_to: SITE.contactEmail,
      }),
    });
    if (!res.ok) console.error("Resend send failed:", await res.text());
  } catch (err) {
    console.error("Resend send threw:", err);
  }
}

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
      // mark_booking_paid (see the guest_payment_rpc_functions migration)
      // is the single source of truth for this side effect now — it does
      // the status update AND the pending-extension-hold resolution in one
      // reviewed, narrow unit of work, rather than this function chaining
      // raw table writes with its own copy of the hold logic.
      const { data: result, error: rpcError } = await supabase.rpc("mark_booking_paid", {
        p_booking_id: booking.id,
        p_method: "mpesa",
        p_reference: payload.telcoReference ? String(payload.telcoReference) : reference,
      });

      if (rpcError) {
        console.error("mark_booking_paid failed", rpcError);
      } else if (!result?.extension_reverted) {
        // If the hold expired or lost the dates right as payment landed,
        // neither the "booking confirmed" nor "extension confirmed" email
        // is true — the admin-facing guest_requests row already covers
        // it, and the guest shouldn't hear anything until a possible
        // refund is sorted out.
        await sendPaymentSucceededEmail(supabase, booking.id, result?.already_paid ?? false);
      }
    } else {
      const { error: rpcError } = await supabase.rpc("mark_booking_payment_failed", {
        p_booking_id: booking.id,
      });
      if (rpcError) console.error("mark_booking_payment_failed failed", rpcError);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ received: true }), { status: 500 });
  }
});
