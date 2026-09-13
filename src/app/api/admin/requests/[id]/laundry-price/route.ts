import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendEmail, laundryStatusEmail } from "@/lib/email";

// Sets the laundry charge and moves the request to "Awaiting Payment" in
// one atomic step — the two must never happen separately, or a guest
// could see "payment due" with no amount and no way to pay (see the
// laundry-stage route's explicit block on setting this status any other
// way). Admin-only: pricing is deliberately not something staff do (see
// HANDOFF's staff-system-review notes on keeping money-adjacent actions
// out of the shared staff login's reach).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);

  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: current, error: fetchError } = await supabase
    .from("guest_requests")
    .select("id, booking_id, status, laundry_payment_status")
    .eq("id", id)
    .eq("request_type", "laundry")
    .maybeSingle();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
  }

  if (current.laundry_payment_status === "Paid") {
    return NextResponse.json(
      { error: "This laundry charge is already paid." },
      { status: 409 },
    );
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("access_token, currency, guest:guests(full_name, email)")
    .eq("id", current.booking_id)
    .maybeSingle();

  const roundedAmount = Math.round(amount * 100) / 100;
  const currency = booking?.currency ?? "KES";

  const { error: updateError } = await supabase
    .from("guest_requests")
    .update({
      laundry_amount: roundedAmount,
      laundry_currency: currency,
      laundry_payment_status: "Pending",
      status: "Awaiting Payment",
      completed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Could not set price." }, { status: 500 });
  }

  const guest = booking?.guest as unknown as { full_name: string; email: string | null } | null;
  if (guest?.email) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { subject, html } = laundryStatusEmail({
      guestName: guest.full_name,
      stage: "Awaiting Payment",
      portalUrl: `${siteUrl}/portal/${booking!.access_token}`,
      amount: roundedAmount,
      currency,
    });
    await sendEmail({ to: guest.email, subject, html });
  }

  return NextResponse.json({ ok: true });
}
