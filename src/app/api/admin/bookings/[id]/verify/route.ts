import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendEmail, idVerificationResultEmail } from "@/lib/email";
import type { Booking } from "@/lib/supabase/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (status !== "Verified" && status !== "Rejected") {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select(
      "id, access_token, booking_status, payment_status, total_amount, currency, guest:guests(full_name, email), room:rooms(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !booking) {
    return NextResponse.json({ error: "Not authorized or booking not found." }, { status: 403 });
  }

  const guest = booking.guest as unknown as { full_name: string; email: string | null } | null;
  const roomName = (booking.room as unknown as { name?: string } | null)?.name ?? "your room";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const portalUrl = `${siteUrl}/portal/${booking.access_token}`;

  async function notify(verificationStatus: "Verified" | "Rejected", refundNote?: string | null) {
    if (!guest?.email) return;
    const { subject, html } = idVerificationResultEmail({
      guestName: guest.full_name,
      roomName,
      portalUrl,
      status: verificationStatus,
      refundNote,
    });
    await sendEmail({ to: guest.email, subject, html });
  }

  if (status === "Verified") {
    const update: Partial<Booking> = {
      id_verification_status: "Verified",
      id_verification_method: "manual_override",
    };
    if (booking.booking_status === "Pending Verification") {
      update.booking_status = "Confirmed";
    }

    const { error } = await supabase.from("bookings").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Could not update verification status." }, { status: 500 });
    }
    await notify("Verified");
    return NextResponse.json({ ok: true });
  }

  // status === "Rejected" — decline the booking and free the calendar.
  // Normally a booking can't reach "Paid" before its ID is "Verified"
  // (the guest portal only shows the payment step once verified), so
  // this only fires in practice when an admin revokes an *earlier*
  // approval on a booking that already paid. Either way, no refund is
  // ever issued automatically here — same manual-refund policy as
  // cancellations (see cancel/route.ts): flag it and let the admin send
  // the money themselves, then confirm via the dashboard's existing Mark
  // Refunded button (which already reads refund_status directly, so no
  // separate alert to send).
  const rejectUpdate: Partial<Booking> = {
    id_verification_status: "Rejected",
    booking_status: "Cancelled",
  };

  const wasPaid = booking.payment_status === "Paid";
  let refundNote: string | null = null;

  if (wasPaid) {
    const amount = Number(booking.total_amount);
    const amountText = new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: booking.currency,
      maximumFractionDigits: 0,
    }).format(amount);

    rejectUpdate.refund_status = "Needs Manual Refund";
    refundNote = `Since your booking was already paid, we're processing your refund of ${amountText} — you'll hear from us shortly.`;
  }

  const { error: updateError } = await supabase.from("bookings").update(rejectUpdate).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: "Could not update verification status." }, { status: 500 });
  }

  await notify("Rejected", refundNote);

  return NextResponse.json({ ok: true });
}
