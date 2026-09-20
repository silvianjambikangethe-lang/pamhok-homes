import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendEmail, checkoutCompleteEmail } from "@/lib/email";

type AdminClient = SupabaseClient<Database>;

export type CheckoutOutcome =
  | { ok: true; alreadyCheckedOut: boolean }
  | { ok: false; status: 404 | 500; error: string };

const BOOKING_SELECT =
  "id, access_token, guest_id, checked_out_at, id_document_path, id_document_back_path, id_document_path_2, id_document_back_path_2, guest:guests(full_name, email), room:rooms(name)";

// The one implementation of "this stay is over" — shared by the guest's own
// check-out button (matched by portal token) and the admin Overview's
// "Mark checked out" (matched by booking id), so a stay closed either way
// ends in exactly the same state, privacy cleanup included.
export async function completeCheckout(
  supabase: AdminClient,
  match: { accessToken: string } | { bookingId: string },
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

  // Sent after the privacy cleanup above only wipes phone/ID files, not
  // email — the guest still needs this to find their way to the review form.
  const guest = booking.guest as unknown as { full_name: string; email: string | null } | null;
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
