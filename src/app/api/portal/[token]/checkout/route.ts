import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendEmail, checkoutCompleteEmail } from "@/lib/email";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, guest_id, checked_out_at, id_document_path, id_selfie_path, guest:guests(full_name, email), room:rooms(name)",
    )
    .eq("access_token", token)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (booking.checked_out_at) {
    return NextResponse.json({ ok: true, alreadyCheckedOut: true });
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not confirm check-out." }, { status: 500 });
  }

  // Privacy cleanup: the ID photo/selfie and phone number have real privacy
  // risk and no ongoing business use once a stay ends. Name, email, dates,
  // payment info, booking_reference, id_verification_status, reviews, and
  // guest_requests all stay for record-keeping.
  const idPaths = [booking.id_document_path, booking.id_selfie_path].filter(
    (p): p is string => !!p,
  );
  await Promise.all([
    idPaths.length > 0
      ? supabase.storage.from("id-documents").remove(idPaths)
      : Promise.resolve(),
    supabase
      .from("bookings")
      .update({ id_document_path: null, id_selfie_path: null })
      .eq("id", booking.id),
    booking.guest_id
      ? supabase.from("guests").update({ phone: null }).eq("id", booking.guest_id)
      : Promise.resolve(),
  ]);

  // Sent after the privacy cleanup above only wipes phone/ID files, not
  // email — the guest still needs this to find their way to the review form.
  const guest = booking.guest as unknown as { full_name: string; email: string | null } | null;
  if (guest?.email) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { subject, html } = checkoutCompleteEmail({
      guestName: guest.full_name,
      roomName: (booking.room as unknown as { name?: string } | null)?.name ?? "your room",
      portalUrl: `${siteUrl}/portal/${token}`,
    });
    await sendEmail({ to: guest.email, subject, html });
  }

  return NextResponse.json({ ok: true });
}
