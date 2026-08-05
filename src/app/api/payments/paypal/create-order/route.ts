import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPaypalAccessToken, isPaypalConfigured, paypalBaseUrl } from "@/lib/paypal";
import { getExchangeRates, type DisplayCurrency } from "@/lib/currency";

// PayPal cannot settle in KES at all. If the guest's currency selector was
// on KES (or they never touched it) when they picked PayPal, fall back to
// USD automatically instead of blocking the payment outright — the guest
// still sees KES as the authoritative price everywhere else.
const PAYPAL_SUPPORTED = new Set<DisplayCurrency>(["USD", "EUR", "GBP"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  const requestedCurrency = body?.currency as DisplayCurrency | undefined;
  const termsAccepted = body?.termsAccepted === true;

  if (typeof token !== "string") {
    return NextResponse.json({ error: "Missing booking token." }, { status: 400 });
  }

  if (!isPaypalConfigured()) {
    return NextResponse.json(
      { error: "Payment method not yet configured.", configured: false },
      { status: 501 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, total_amount, currency, payment_status, id_verification_status, terms_accepted_at")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (booking.payment_status === "Paid") {
    return NextResponse.json({ error: "This booking is already paid." }, { status: 409 });
  }

  if (booking.id_verification_status !== "Verified") {
    return NextResponse.json(
      { error: "Please complete ID verification before paying." },
      { status: 403 },
    );
  }

  if (!termsAccepted) {
    return NextResponse.json(
      { error: "Please accept the Terms & Conditions and Privacy Policy before paying." },
      { status: 403 },
    );
  }

  // Record consent once, the first time — a single fast row update that
  // doesn't add meaningful latency next to the PayPal API calls below.
  if (!booking.terms_accepted_at) {
    await supabase
      .from("bookings")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("id", booking.id);
  }

  const chargeCurrency: DisplayCurrency =
    requestedCurrency && PAYPAL_SUPPORTED.has(requestedCurrency) ? requestedCurrency : "USD";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    // Recompute the converted amount server-side from our own cached
    // rates — never trust a client-supplied money value.
    const rates = await getExchangeRates();
    const chargeAmount = booking.total_amount * (rates[chargeCurrency] ?? 1);

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
          return_url: `${siteUrl}/api/payments/paypal/capture?bookingToken=${token}`,
          cancel_url: `${siteUrl}/portal/${token}?paypal=cancel`,
          user_action: "PAY_NOW",
        },
      }),
    });

    const order = await orderRes.json();

    if (!orderRes.ok) {
      return NextResponse.json({ error: "Could not start PayPal checkout." }, { status: 502 });
    }

    const approveLink = order.links?.find(
      (link: { rel: string; href: string }) => link.rel === "approve",
    );

    if (!approveLink) {
      return NextResponse.json({ error: "Could not start PayPal checkout." }, { status: 502 });
    }

    return NextResponse.json({ url: approveLink.href, chargedCurrency: chargeCurrency });
  } catch {
    return NextResponse.json({ error: "Could not reach PayPal." }, { status: 502 });
  }
}
