// Supabase Edge Function: receives Jenga PGW hosted-checkout's callback after
// a guest finishes (or abandons) paying — by M-Pesa/Equitel or card — for a
// booking or a laundry charge, and marks the matching row Paid/Failed.
//
// Deploy with verify_jwt = false: Jenga sends this as a plain GET redirect of
// the GUEST'S OWN BROWSER, so there is no Supabase auth header to check.
//
// KNOWN GAP: Jenga's `secureResponse` query parameter (a signed/encrypted
// blob; format unpublished) is NOT verified. Compensating controls: the orderReference is random per
// attempt and never shown to the guest (so it can't be forged for a booking),
// and the callback's amount must cover the stored amount before anything is
// marked Paid. The full raw query is logged so the hash formula can be
// worked out later.
//
// Duplicates sendPaymentSucceededEmail from src/lib/email.ts (Edge Functions
// deployed by hand can't import it) — keep in sync if the copy changes.

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
  // Field names are the ones Jenga ACTUALLY sends (seen in a live callback,
  // 2026-09-24): transactionStatus / transactionAmount / paymentChannel /
  // responseStatus. Jenga's docs list status / amount / desc instead, so the
  // documented names are kept as fallbacks.
  const status = (params.get("transactionStatus") ?? params.get("status") ?? "").toLowerCase();
  const responseOk = params.get("responseStatus");
  const channel = params.get("paymentChannel") ?? params.get("desc") ?? "";
  const paidAmount = Number(params.get("transactionAmount") ?? params.get("amount"));

  console.log("jenga-pgw-callback raw query:", url.search);

  const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? "https://www.pamhokhomes.com";

  if (!orderReference) {
    return new Response("Missing orderReference.", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const method = /mpesa|m-pesa|mobile|equitel|airtel|mkey/i.test(channel) ? "mpesa" : "card";
  const success =
    (status === "success" || status === "paid") && responseOk !== "false";
  // Only an explicit failure marks a payment Failed; an unknown or still-
  // processing status leaves the booking untouched.
  const failed =
    !success && (responseOk === "false" || /fail|declin|cancel|error|reject|expire/.test(status));

  // Every issued reference is recorded in payment_attempts (see
  // jenga-pgw-initiate), so an earlier attempt still resolves after the guest
  // starts another. Fall back to the payment_reference columns for attempts
  // issued before that table existed. Laundry references carry an LND prefix.
  const { data: attempt } = await supabase
    .from("payment_attempts")
    .select("booking_id, request_id")
    .eq("reference", orderReference)
    .maybeSingle();
  const isLaundry = attempt ? attempt.request_id !== null : orderReference.startsWith("LND");

  if (isLaundry) {
    let laundryQuery = supabase
      .from("guest_requests")
      .select("id, laundry_amount, laundry_payment_status, booking:bookings(access_token)")
      .eq("request_type", "laundry");
    laundryQuery = attempt
      ? laundryQuery.eq("id", attempt.request_id)
      : laundryQuery.eq("laundry_payment_reference", orderReference);
    const { data: laundry } = await laundryQuery.maybeSingle();

    if (!laundry) {
      console.error("jenga-pgw-callback: no laundry request for", orderReference);
      return Response.redirect(siteUrl, 302);
    }
    const booking = Array.isArray(laundry.booking) ? laundry.booking[0] : laundry.booking;
    const portalBase = `${siteUrl}/portal/${booking?.access_token}`;

    // Jenga may add its own fee on top, so only underpayment is rejected.
    if (success && paidAmount + 1 >= Number(laundry.laundry_amount)) {
      const { error } = await supabase.rpc("mark_laundry_paid", {
        p_request_id: laundry.id,
        p_method: method,
        p_reference: orderReference,
      });
      if (error) console.error("mark_laundry_paid failed", error);
      return Response.redirect(`${portalBase}?payment=success`, 302);
    }
    if (success) {
      console.error("jenga-pgw-callback: laundry amount mismatch", orderReference, paidAmount);
    } else if (failed && laundry.laundry_payment_status !== "Paid") {
      const { error } = await supabase.rpc("mark_laundry_payment_failed", {
        p_request_id: laundry.id,
      });
      if (error) console.error("mark_laundry_payment_failed failed", error);
    }
    return Response.redirect(`${portalBase}?payment=${failed || success ? "failed" : "pending"}`, 302);
  }

  let bookingQuery = supabase
    .from("bookings")
    .select("id, room_id, check_in, check_out, access_token, total_amount, payment_status");
  bookingQuery = attempt
    ? bookingQuery.eq("id", attempt.booking_id)
    : bookingQuery.eq("payment_reference", orderReference);
  const { data: booking } = await bookingQuery.maybeSingle();

  if (!booking) {
    console.error("jenga-pgw-callback: no booking for orderReference", orderReference);
    return Response.redirect(siteUrl, 302);
  }

  const portalBase = `${siteUrl}/portal/${booking.access_token}`;

  // Jenga may add its own fee on top, so only underpayment is rejected.
  if (success && paidAmount + 1 >= Number(booking.total_amount)) {
    // mark_booking_paid is the single source of truth for this write (see
    // the guest_payment_rpc_functions migration).
    const { data: result, error: rpcError } = await supabase.rpc("mark_booking_paid", {
      p_booking_id: booking.id,
      p_method: method,
      p_reference: orderReference,
    });
    if (rpcError) {
      console.error("mark_booking_paid failed", rpcError);
    } else if (result?.already_paid) {
      // A second successful payment for an already-paid booking: the guest
      // was charged twice and may be owed a refund.
      console.error("jenga-pgw-callback: DUPLICATE PAYMENT", orderReference, paidAmount);
    } else {
      // A booking only takes its dates once paid (plus a short payment-window
      // hold), so two guests can, very rarely, still pay for the same dates.
      // Look at PAID or host-blocked bookings only (another guest's open
      // payment window is not a clash) and flag any overlap so one guest can
      // be refunded.
      if (booking.room_id) {
        const { data: overlapping } = await supabase
          .from("bookings")
          .select("id")
          .eq("room_id", booking.room_id)
          .neq("id", booking.id)
          .or("paid_at.not.is.null,booking_status.eq.Blocked")
          .in("booking_status", ["Confirmed", "Pending Verification", "Blocked"])
          .lt("check_in", booking.check_out)
          .gt("check_out", booking.check_in);
        if (overlapping && overlapping.length > 0) {
          console.error("jenga-pgw-callback: DOUBLE BOOKING", orderReference, booking.room_id);
          const { error: eventError } = await supabase.from("security_events").insert({
            event_type: "double_booking_conflict",
            booking_id: booking.id,
            detail: { reference: orderReference, check_in: booking.check_in, check_out: booking.check_out },
          });
          if (eventError) console.error("security_events insert failed", eventError);
        }
      }
      if (!result?.extension_reverted) {
        await sendPaymentSucceededEmail(supabase, booking.id);
      }
    }
    return Response.redirect(`${portalBase}?payment=success`, 302);
  }

  if (success) {
    console.error("jenga-pgw-callback: amount mismatch", orderReference, paidAmount);
  } else if (failed && booking.payment_status !== "Paid") {
    const { error: rpcError } = await supabase.rpc("mark_booking_payment_failed", {
      p_booking_id: booking.id,
    });
    if (rpcError) console.error("mark_booking_payment_failed failed", rpcError);
  }
  return Response.redirect(`${portalBase}?payment=${failed || success ? "failed" : "pending"}`, 302);
});
