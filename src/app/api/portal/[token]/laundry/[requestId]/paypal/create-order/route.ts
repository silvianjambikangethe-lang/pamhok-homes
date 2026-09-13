import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPaypalAccessToken, isPaypalConfigured, paypalBaseUrl } from "@/lib/paypal";
import { getExchangeRates, type DisplayCurrency } from "@/lib/currency";

// Same shape as /api/payments/paypal/create-order, scoped to a laundry
// charge (guest_requests.laundry_*) instead of the booking's own
// total_amount/payment_status — the two must stay independent since a
// booking can have a stay payment and a laundry charge in flight at once.
const PAYPAL_SUPPORTED = new Set<DisplayCurrency>(["USD", "EUR", "GBP"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; requestId: string }> },
) {
  const { token, requestId } = await params;
  const body = await request.json().catch(() => null);
  const requestedCurrency = body?.currency as DisplayCurrency | undefined;

  if (!isPaypalConfigured()) {
    return NextResponse.json(
      { error: "Payment method not yet configured.", configured: false },
      { status: 501 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("access_token", token)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const { data: laundryRequest, error } = await supabase
    .from("guest_requests")
    .select("id, laundry_amount, laundry_payment_status")
    .eq("id", requestId)
    .eq("booking_id", booking.id)
    .eq("request_type", "laundry")
    .maybeSingle();

  if (error || !laundryRequest || !laundryRequest.laundry_amount) {
    return NextResponse.json({ error: "Laundry request not found." }, { status: 404 });
  }

  if (laundryRequest.laundry_payment_status === "Paid") {
    return NextResponse.json({ error: "This laundry charge is already paid." }, { status: 409 });
  }

  const chargeCurrency: DisplayCurrency =
    requestedCurrency && PAYPAL_SUPPORTED.has(requestedCurrency) ? requestedCurrency : "USD";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const rates = await getExchangeRates();
    const chargeAmount = laundryRequest.laundry_amount * (rates[chargeCurrency] ?? 1);

    const accessToken = await getPaypalAccessToken();

    const orderRes = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: chargeCurrency,
              value: chargeAmount.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: `${siteUrl}/api/portal/${token}/laundry/${requestId}/paypal/capture`,
          cancel_url: `${siteUrl}/portal/${token}?laundryPaypal=cancel`,
          user_action: "PAY_NOW",
        },
      }),
    });

    const order = await orderRes.json();

    if (!orderRes.ok) {
      console.error("PayPal create-order failed", orderRes.status, JSON.stringify(order));
      return NextResponse.json({ error: "Could not start PayPal checkout." }, { status: 502 });
    }

    const approveLink = order.links?.find(
      (link: { rel: string; href: string }) => link.rel === "approve",
    );

    if (!approveLink) {
      return NextResponse.json({ error: "Could not start PayPal checkout." }, { status: 502 });
    }

    // Bind this order to this specific laundry request, same reasoning as
    // the booking flow: a capture must only ever be able to mark THIS
    // charge paid, never a different (possibly larger) one reused by id.
    await supabase
      .from("guest_requests")
      .update({ laundry_payment_method: "paypal", laundry_payment_reference: order.id })
      .eq("id", requestId);

    return NextResponse.json({ url: approveLink.href, chargedCurrency: chargeCurrency });
  } catch {
    return NextResponse.json({ error: "Could not reach PayPal." }, { status: 502 });
  }
}
