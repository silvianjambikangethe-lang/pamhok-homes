import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendPaymentSucceededEmail } from "@/lib/booking-emails";
import { resolvePendingExtensionAfterPayment } from "@/lib/extension-hold";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: before } = await supabase
    .from("bookings")
    .select("paid_at")
    .eq("id", id)
    .maybeSingle();
  const wasAlreadyPaid = before?.paid_at != null;

  const { data, error } = await supabase
    .from("bookings")
    .update({
      payment_status: "Paid",
      payment_method: "manual",
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not update booking." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or booking not found." }, { status: 403 });
  }

  // A stay extension only takes effect once its payment actually clears —
  // this applies the held pending_extension_check_out now (re-checking
  // the hold hasn't expired and nobody else took the dates in the
  // meantime), rather than when the guest merely requested it. No-op
  // ("none") if there's no pending extension on this booking.
  const extensionResolution = await resolvePendingExtensionAfterPayment(supabase, id);

  // If the hold expired or lost the dates right as payment landed,
  // neither the "booking confirmed" nor "extension confirmed" email is
  // true — admin was already notified (see
  // resolvePendingExtensionAfterPayment) and needs to sort out a possible
  // refund before the guest hears anything.
  if (extensionResolution !== "reverted") {
    await sendPaymentSucceededEmail(supabase, id, wasAlreadyPaid);
  }

  return NextResponse.json({ ok: true });
}
