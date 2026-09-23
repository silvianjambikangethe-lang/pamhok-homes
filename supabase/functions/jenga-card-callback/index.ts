// Supabase Edge Function: receives Jenga PGW Checkout's callback after a
// guest finishes (or abandons) paying by card, and marks the matching
// booking Paid/Failed — the card-payment counterpart to mpesa-callback.
//
// Deploy with verify_jwt = false: unlike mpesa-callback (a server-to-server
// webhook), Jenga sends this as a plain GET redirect of the GUEST'S OWN
// BROWSER back to callbackUrl after they finish on Jenga's hosted checkout
// page — there's no Supabase auth header to check, so JWT verification
// must stay off for this function.
//
// SANDBOX ONLY FOR NOW: this only ever gets hit as a result of
// jenga-card-initiate's sandbox-only checkout (uat.finserve.africa /
// v3-uat.jengapgw.io) — nothing here talks to Jenga directly, it just
// reads the query string Jenga's redirect carries.
//
// KNOWN GAP, same as mpesa-callback: this does NOT verify Jenga's `hash`
// query parameter. Jenga's public docs describe the callback fields
// (transactionId, status, date, desc, amount, orderReference, hash,
// extraData) but never publish the hash formula. This logs the full raw
// query string so a real sandbox test's Edge Function logs can be used to
// work out the formula later — don't trust this callback for real money
// until that's added.
//
// Duplicates sendPaymentSucceededEmail from _shared/email.ts — same reason
// mpesa-callback can't import Next.js code, and the deploy path used for
// this function doesn't resolve relative shared imports either. Keep in
// sync with _shared/email.ts and src/lib/email.ts if the copy changes.

import { createClient } from "npm:@supabase/supabase-js@2";

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
async function sendPaymentSucceededEmail(supabase: any, bookingId: string): Promise<void> {
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

  const html = wrapper(`
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
  `);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress(),
        to: guest.email,
        subject: `Payment confirmed — ${roomName}, ${booking.check_in} to ${booking.check_out}`,
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
  const url = new URL(req.url);
  const params = url.searchParams;
  const orderReference = params.get("orderReference");
  const status = params.get("status");

  console.log("jenga-card-callback raw query:", url.search);

  const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://www.pamhokhomes.com";

  if (!orderReference) {
    return new Response("Missing orderReference.", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, access_token")
    .eq("payment_reference", orderReference)
    .eq("payment_method", "card")
    .maybeSingle();

  if (!booking) {
    console.error("jenga-card-callback: no booking for orderReference", orderReference);
    return Response.redirect(siteUrl, 302);
  }

  const success = (status ?? "").toLowerCase() === "paid";

  if (success) {
    // mark_booking_paid (see the guest_payment_rpc_functions migration) is
    // the single source of truth for this write now, same reasoning as
    // mpesa-callback's use of the same function.
    const { data: result, error: rpcError } = await supabase.rpc("mark_booking_paid", {
      p_booking_id: booking.id,
      p_method: "card",
      p_reference: orderReference,
    });
    if (rpcError) {
      console.error("mark_booking_paid failed", rpcError);
    } else if (!result?.already_paid && !result?.extension_reverted) {
      await sendPaymentSucceededEmail(supabase, booking.id);
    }
  } else {
    const { error: rpcError } = await supabase.rpc("mark_booking_payment_failed", {
      p_booking_id: booking.id,
    });
    if (rpcError) console.error("mark_booking_payment_failed failed", rpcError);
  }

  const portalUrl = `${siteUrl}/portal/${booking.access_token}?payment=${success ? "success" : "failed"}`;
  return Response.redirect(portalUrl, 302);
});
