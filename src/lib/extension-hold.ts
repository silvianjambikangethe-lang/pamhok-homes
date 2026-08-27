import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// A guest's stay-extension request holds the extra nights (via
// availability_view — see the migration that added this) for up to this
// long while they arrange payment. Vercel's cron on this project's
// current (Hobby) plan can only run once a day, which can't reliably
// enforce a 3-hour window on its own — so the real enforcement is lazy:
// releaseExpiredExtensionHold() is called any time a booking with a
// pending extension is read (portal page, verify page, extend/check,
// extend/confirm), so a stale hold self-heals the moment anyone next
// looks at it, independent of cron frequency. The daily cron
// (cron/expire-extension-holds) is only a backstop for a booking nobody
// ever reloads.
export const EXTENSION_HOLD_HOURS = 3;
const HOLD_MS = EXTENSION_HOLD_HOURS * 60 * 60 * 1000;

type AdminClient = SupabaseClient<Database>;

export function extensionHoldExpiresAt(requestedAt: string): Date {
  return new Date(new Date(requestedAt).getTime() + HOLD_MS);
}

export function isExtensionHoldExpired(requestedAt: string, now: Date = new Date()): boolean {
  return extensionHoldExpiresAt(requestedAt).getTime() <= now.getTime();
}

interface BookingHoldFields {
  id: string;
  payment_status: string;
  total_amount: number;
  pending_extension_check_out: string | null;
  pending_extension_amount: number | null;
  pending_extension_requested_at: string | null;
}

async function closeOpenExtensionRequests(supabase: AdminClient, bookingId: string) {
  await supabase
    .from("guest_requests")
    .update({ status: "Closed" })
    .eq("booking_id", bookingId)
    .eq("request_type", "extension")
    .eq("status", "Open");
}

// Reverts a stale, still-unpaid pending extension back to "never
// happened" (dates untouched, amount owed drops back down) and notifies
// admin. Safe to call on every booking read — a no-op unless there's
// actually an expired, unpaid hold. Returns true if it reverted anything
// (callers that already have a `booking` object in hand should re-read it
// after a true return).
export async function releaseExpiredExtensionHold(
  supabase: AdminClient,
  booking: BookingHoldFields,
): Promise<boolean> {
  if (
    !booking.pending_extension_check_out ||
    booking.payment_status !== "Pending" ||
    !booking.pending_extension_requested_at ||
    !isExtensionHoldExpired(booking.pending_extension_requested_at)
  ) {
    return false;
  }

  await supabase
    .from("bookings")
    .update({
      total_amount: booking.total_amount - (booking.pending_extension_amount ?? 0),
      payment_status: "Paid",
      pending_extension_check_out: null,
      pending_extension_nights: null,
      pending_extension_amount: null,
      pending_extension_requested_at: null,
    })
    .eq("id", booking.id);

  await closeOpenExtensionRequests(supabase, booking.id);
  await supabase.from("guest_requests").insert({
    booking_id: booking.id,
    request_type: "extension",
    message: `Extension hold expired unpaid after ${EXTENSION_HOLD_HOURS} hours — released, dates unchanged.`,
    status: "Open",
  });

  return true;
}

// Called right after a booking's payment_status has just been set to
// "Paid" by one of the payment-completion paths (PayPal capture, admin
// mark-paid, the mpesa-callback edge function). Applies a pending
// extension if one is waiting and still valid, or reverts it (with an
// admin notification, so a human can check whether a refund of the
// difference is owed) if the hold expired or the dates got taken by
// someone else in the meantime.
export type ExtensionResolution = "applied" | "reverted" | "none";

export async function resolvePendingExtensionAfterPayment(
  supabase: AdminClient,
  bookingId: string,
): Promise<ExtensionResolution> {
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, room_id, check_out, total_amount, pending_extension_check_out, pending_extension_nights, pending_extension_amount, pending_extension_requested_at",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking || !booking.pending_extension_check_out) return "none";

  const expired =
    !booking.pending_extension_requested_at ||
    isExtensionHoldExpired(booking.pending_extension_requested_at);

  let conflict = false;
  if (!expired && booking.room_id) {
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("room_id", booking.room_id)
      .neq("id", booking.id)
      .in("booking_status", ["Confirmed", "Blocked", "Pending Verification"])
      .lt("check_in", booking.pending_extension_check_out)
      .gt("check_out", booking.check_out);
    conflict = !!conflicts && conflicts.length > 0;
  }

  await closeOpenExtensionRequests(supabase, booking.id);

  if (expired || conflict) {
    await supabase
      .from("bookings")
      .update({
        total_amount: booking.total_amount - (booking.pending_extension_amount ?? 0),
        pending_extension_check_out: null,
        pending_extension_nights: null,
        pending_extension_amount: null,
        pending_extension_requested_at: null,
      })
      .eq("id", booking.id);

    await supabase.from("guest_requests").insert({
      booking_id: booking.id,
      request_type: "extension",
      message: expired
        ? "Guest paid, but their extension hold had already expired (3hr window passed) before payment cleared — extra nights were NOT granted, amount adjusted back down. Check whether a refund of the difference is owed."
        : "Guest paid, but the extra nights were booked by someone else in the meantime — extra nights were NOT granted, amount adjusted back down. Check whether a refund of the difference is owed.",
      status: "Open",
    });
    return "reverted";
  }

  await supabase
    .from("bookings")
    .update({
      check_out: booking.pending_extension_check_out,
      pending_extension_check_out: null,
      pending_extension_nights: null,
      pending_extension_amount: null,
      pending_extension_requested_at: null,
    })
    .eq("id", booking.id);

  await supabase.from("guest_requests").insert({
    booking_id: booking.id,
    request_type: "extension",
    message: `Extension confirmed — payment received for ${booking.pending_extension_nights} extra night${booking.pending_extension_nights === 1 ? "" : "s"}. Stay now extends to ${booking.pending_extension_check_out}.`,
    status: "Open",
  });

  return "applied";
}
