import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPaypalAccessToken, paypalBaseUrl } from "@/lib/paypal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingToken = searchParams.get("bookingToken");
  const orderId = searchParams.get("token"); // PayPal's own order id
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (!bookingToken || !orderId) {
    return NextResponse.redirect(`${siteUrl}/`);
  }

  try {
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

      const supabase = createAdminSupabaseClient();
      await supabase
        .from("bookings")
        .update({
          payment_status: "Paid",
          payment_method: "paypal",
          payment_reference: captureId,
          paid_at: new Date().toISOString(),
        })
        .eq("access_token", bookingToken);

      return NextResponse.redirect(`${siteUrl}/portal/${bookingToken}?paypal=success`);
    }

    return NextResponse.redirect(`${siteUrl}/portal/${bookingToken}?paypal=failed`);
  } catch {
    return NextResponse.redirect(`${siteUrl}/portal/${bookingToken}?paypal=failed`);
  }
}
