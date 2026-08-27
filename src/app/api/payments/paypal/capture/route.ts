import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPaypalAccessToken, paypalBaseUrl } from "@/lib/paypal";
import { sendPaymentSucceededEmail } from "@/lib/booking-emails";
import { resolvePendingExtensionAfterPayment } from "@/lib/extension-hold";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingToken = searchParams.get("bookingToken");
  const orderId = searchParams.get("token"); // PayPal's own order id
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!bookingToken || !orderId) {
    return NextResponse.redirect(`${siteUrl}/`);
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, payment_status, payment_reference, paid_at, pending_extension_check_out")
      .eq("access_token", bookingToken)
      .maybeSingle();

    if (!booking) {
      return NextResponse.redirect(`${siteUrl}/`);
    }

    // Already captured (e.g. the guest hit back/refresh on this redirect) —
    // don't attempt a second capture against PayPal, just show success.
    if (booking.payment_status === "Paid") {
      return NextResponse.redirect(`${siteUrl}/portal/${bookingToken}?paypal=success`);
    }

    // This order must be the one create-order created for THIS booking —
    // otherwise a guest could pay for a cheap booking and reuse that order
    // id here to mark a completely different, more expensive booking Paid.
    if (booking.payment_reference !== orderId) {
      return NextResponse.redirect(`${siteUrl}/portal/${bookingToken}?paypal=failed`);
    }

    const accessToken = await getPaypalAccessToken();

    const captureRes = await fetch(
      `${paypalBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const capture = await captureRes.json();

    if (captureRes.ok && capture.status === "COMPLETED") {
      const captureId =
        capture.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? orderId;

      await supabase
        .from("bookings")
        .update({
          payment_status: "Paid",
          payment_method: "paypal",
          payment_reference: captureId,
          paid_at: new Date().toISOString(),
        })
        .eq("access_token", bookingToken);

      // A stay extension only takes effect once its payment actually
      // clears — this applies the held pending_extension_check_out now
      // (re-checking the hold hasn't expired and nobody else took the
      // dates in the meantime), rather than when the guest merely
      // requested it. No-op ("none") if there's no pending extension on
      // this booking.
      const extensionResolution = await resolvePendingExtensionAfterPayment(supabase, booking.id);

      // If the hold expired or lost the dates right as payment landed,
      // neither the "booking confirmed" nor "extension confirmed" email
      // is true — admin was already notified (see
      // resolvePendingExtensionAfterPayment) and needs to sort out a
      // possible refund before the guest hears anything.
      if (extensionResolution !== "reverted") {
        await sendPaymentSucceededEmail(supabase, booking.id, booking.paid_at !== null);
      }

      return NextResponse.redirect(`${siteUrl}/portal/${bookingToken}?paypal=success`);
    }

    return NextResponse.redirect(`${siteUrl}/portal/${bookingToken}?paypal=failed`);
  } catch {
    return NextResponse.redirect(`${siteUrl}/portal/${bookingToken}?paypal=failed`);
  }
}
