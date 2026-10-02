import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendEmail, checkoutCompleteEmail } from "@/lib/email";

type AdminClient = SupabaseClient<Database>;

export type CheckoutOutcome =
  | { ok: true; alreadyCheckedOut: boolean }
  | { ok: false; status: 404 | 500; error: string };

const BOOKING_SELECT =
  "id, access_token, guest_id, checked_out_at, id_verification_status, id_document_path, id_document_back_path, id_document_path_2, id_document_back_path_2, guest:guests(full_name, email, phone), room:rooms(name)";

// The one implementation of "this stay is over" — shared by the guest's own
// check-out button (matched by portal token) and the admin Overview's
// "Mark checked out" (matched by booking id), so a stay closed either way
// ends in exactly the same state, privacy cleanup included.
//
// rememberMe only comes from the guest's own check-out flow (see
// CheckoutSection.tsx / /api/portal/[token]/checkout) — it's left
// undefined for the admin-triggered "Mark checked out" path, which has no
// guest answer to act on and must not silently opt them in or revoke a
// prior opt-in. true/false are both explicit guest answers: true stores
// (or refreshes) a remembered_guests row for the "Remember Me" flow in
// src/lib/guest-recognition.ts, provided this stay was actually ID
// verified; false revokes any existing row, since consent should reflect
// what the guest chose this time, not a sticky default.
export async function completeCheckout(
  supabase: AdminClient,
  match: { accessToken: string } | { bookingId: string },
  rememberMe?: boolean,
): Promise<CheckoutOutcome> {
  const base = supabase.from("bookings").select(BOOKING_SELECT);
  const { data: booking, error: bookingError } = await (
    "accessToken" in match
      ? base.eq("access_token", match.accessToken)
      : base.eq("id", match.bookingId)
  ).maybeSingle();

  if (bookingError || !booking) {
    return { ok: false, status: 404, error: "Booking not found." };
  }

  if (booking.checked_out_at) {
    return { ok: true, alreadyCheckedOut: true };
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateError) {
    return { ok: false, status: 500, error: "Could not confirm check-out." };
  }

  // Privacy cleanup: the ID front/back photos and phone number have real
  // privacy risk and no ongoing business use once a stay ends. Name, email,
  // dates, payment info, booking_reference, id_verification_status,
  // reviews, and guest_requests all stay for record-keeping. Covers both
  // verification attempts, not just the first.
  const idPaths = [
    booking.id_document_path,
    booking.id_document_back_path,
    booking.id_document_path_2,
    booking.id_document_back_path_2,
  ].filter((p): p is string => !!p);
  await Promise.all([
    idPaths.length > 0
      ? supabase.storage.from("id-documents").remove(idPaths)
      : Promise.resolve(),
    supabase
      .from("bookings")
      .update({
        id_document_path: null,
        id_document_back_path: null,
        id_document_path_2: null,
        id_document_back_path_2: null,
      })
      .eq("id", booking.id),
    booking.guest_id
      ? supabase.from("guests").update({ phone: null }).eq("id", booking.guest_id)
      : Promise.resolve(),
  ]);

  // Read from the booking fetched above, i.e. before the cleanup wiped
  // guests.phone, so the opt-in can keep the number the guest gave.
  const guest = booking.guest as unknown as {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;

  if (rememberMe === true && guest?.email && booking.id_verification_status === "Verified") {
    const email = guest.email.trim().toLowerCase();
    await supabase.from("remembered_guests").upsert({
      email,
      full_name: guest.full_name,
      phone: guest.phone,
      last_booking_id: booking.id,
      updated_at: new Date().toISOString(),
    });
  } else if (rememberMe === false && guest?.email) {
    await supabase
      .from("remembered_guests")
      .delete()
      .eq("email", guest.email.trim().toLowerCase());
  }

  // Sent after the privacy cleanup above only wipes phone/ID files, not
  // email — the guest still needs this to find their way to the review form.
  if (guest?.email) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { subject, html } = checkoutCompleteEmail({
      guestName: guest.full_name,
      roomName: (booking.room as unknown as { name?: string } | null)?.name ?? "your room",
      portalUrl: `${siteUrl}/portal/${booking.access_token}`,
    });
    await sendEmail({ to: guest.email, subject, html });
  }

  return { ok: true, alreadyCheckedOut: false };
}
