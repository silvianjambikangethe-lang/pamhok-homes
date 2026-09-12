import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPaypalAccessToken, paypalBaseUrl } from "@/lib/paypal";

// Mirrors /api/payments/paypal/capture for the booking's own payment,
// scoped to one laundry request's guest_requests.laundry_* columns.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; requestId: string }> },
) {
  const { token, requestId } = await params;
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("token"); // PayPal's own order id
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!orderId) {
    return NextResponse.redirect(`${siteUrl}/portal/${token}`);
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data: laundryRequest } = await supabase
      .from("guest_requests")
      .select("id, laundry_payment_status, laundry_payment_reference")
      .eq("id", requestId)
      .eq("request_type", "laundry")
      .maybeSingle();

    if (!laundryRequest) {
      return NextResponse.redirect(`${siteUrl}/portal/${token}`);
    }

    // Already captured (e.g. the guest hit back/refresh on this redirect).
    if (laundryRequest.laundry_payment_status === "Paid") {
      return NextResponse.redirect(`${siteUrl}/portal/${token}?laundryPaypal=success`);
    }

    // This order must be the one create-order created for THIS laundry
    // request — otherwise a guest could reuse an order id from a cheap
    // charge to mark a different, more expensive one Paid.
    if (laundryRequest.laundry_payment_reference !== orderId) {
      return NextResponse.redirect(`${siteUrl}/portal/${token}?laundryPaypal=failed`);
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
        .from("guest_requests")
        .update({
          laundry_payment_status: "Paid",
          laundry_payment_method: "paypal",
          laundry_payment_reference: captureId,
          laundry_paid_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return NextResponse.redirect(`${siteUrl}/portal/${token}?laundryPaypal=success`);
    }

    return NextResponse.redirect(`${siteUrl}/portal/${token}?laundryPaypal=failed`);
  } catch {
    return NextResponse.redirect(`${siteUrl}/portal/${token}?laundryPaypal=failed`);
  }
}
