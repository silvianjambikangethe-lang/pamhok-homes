import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendEmail,
  bookingConfirmationEmail,
  stayExtensionConfirmationEmail,
} from "@/lib/email";

// Single call site for "payment_status just became Paid", used by every
// path that can cause that transition: PayPal capture, the Jenga M-Pesa
// callback (its own duplicate implementation — Deno Edge Functions can't
// import this file, see supabase/functions/mpesa-callback/index.ts), and
// the admin manual mark-paid route. Centralized here instead of repeated
// per call site so the two email variants can't drift out of sync.
//
// `wasAlreadyPaid` is the caller's read of the booking's prior paid_at
// (i.e. before this update) — that's the only reliable signal for "is
// this a fresh booking's first payment, or a re-payment after an
// extension reset payment_status back to Pending" (see
// extend/confirm/route.ts, which never marks a booking's own kind).
export async function sendPaymentSucceededEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bookingId: string,
  wasAlreadyPaid: boolean,
) {
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "check_in, check_out, total_amount, currency, booking_reference, access_token, guest:guests(full_name, email), room:rooms(name)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  const guest = booking?.guest as unknown as { full_name: string; email: string | null } | null;
  if (!booking || !guest?.email) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const portalUrl = `${siteUrl}/portal/${booking.access_token}`;
  const roomName = (booking.room as { name?: string } | null)?.name ?? "your room";

  if (wasAlreadyPaid) {
    const { subject, html } = stayExtensionConfirmationEmail({
      guestName: guest.full_name,
      roomName,
      newCheckOut: booking.check_out,
      totalPaid: booking.total_amount,
      currency: booking.currency,
      portalUrl,
    });
    await sendEmail({ to: guest.email, subject, html });
    return;
  }

  const { subject, html } = bookingConfirmationEmail({
    guestName: guest.full_name,
    roomName,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    bookingReference: booking.booking_reference,
    amountPaid: booking.total_amount,
    currency: booking.currency,
    portalUrl,
  });
  await sendEmail({ to: guest.email, subject, html });
}
