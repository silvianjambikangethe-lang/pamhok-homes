import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// A guest who opens Jenga's hosted checkout but never finishes (closes the
// tab, Jenga's own page errors out before they submit, etc.) leaves nothing
// behind for jenga-pgw-callback to act on — Jenga never calls back, so the
// booking/laundry charge just sits at payment_status "Pending" forever. The
// 15-minute date hold (availability_view, payment_window_hold migration)
// already releases the ROOM on its own; this only cleans up the stale ROW so
// it stops looking like a live, in-progress payment on the admin dashboard.
//
// 45 minutes is well past the 15-minute date hold and Jenga's own 15-minute
// paymentTimeLimit, so it only catches attempts that are genuinely
// abandoned, not ones still in progress.
export const PENDING_PAYMENT_STALE_MINUTES = 45;
const STALE_MS = PENDING_PAYMENT_STALE_MINUTES * 60 * 1000;

type AdminClient = SupabaseClient<Database>;

function isStale(referenceTime: string, now: Date): boolean {
  return new Date(referenceTime).getTime() + STALE_MS <= now.getTime();
}

// The last time a guest actually did something toward paying — the most
// recent payment_attempts row — or, if they never even reached Jenga,
// the booking/request's own created_at.
async function latestAttemptOrCreatedAt(
  supabase: AdminClient,
  column: "booking_id" | "request_id",
  id: string,
  createdAt: string,
): Promise<string> {
  const { data } = await supabase
    .from("payment_attempts")
    .select("created_at")
    .eq(column, id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ?? createdAt;
}

// Flips a stale, unpaid booking from "Pending" to "Failed" — same end state
// jenga-pgw-callback would have set had Jenga actually reported a decline.
// Safe to call on every booking read — a no-op unless genuinely stale.
export async function expireStaleBookingPayment(
  supabase: AdminClient,
  booking: { id: string; payment_status: string; paid_at: string | null; created_at: string },
  now: Date = new Date(),
): Promise<boolean> {
  if (booking.payment_status !== "Pending" || booking.paid_at) return false;

  const referenceTime = await latestAttemptOrCreatedAt(
    supabase,
    "booking_id",
    booking.id,
    booking.created_at,
  );
  if (!isStale(referenceTime, now)) return false;

  await supabase.from("bookings").update({ payment_status: "Failed" }).eq("id", booking.id);
  await supabase.from("security_events").insert({
    event_type: "mark_booking_payment_failed",
    booking_id: booking.id,
    detail: { reason: "stale_pending_no_callback" },
  });
  return true;
}

// Same idea for a laundry charge (guest_requests.laundry_payment_status).
export async function expireStaleLaundryPayment(
  supabase: AdminClient,
  request: { id: string; laundry_payment_status: string | null; created_at: string },
  now: Date = new Date(),
): Promise<boolean> {
  if (request.laundry_payment_status !== "Pending") return false;

  const referenceTime = await latestAttemptOrCreatedAt(
    supabase,
    "request_id",
    request.id,
    request.created_at,
  );
  if (!isStale(referenceTime, now)) return false;

  await supabase
    .from("guest_requests")
    .update({ laundry_payment_status: "Failed", updated_at: now.toISOString() })
    .eq("id", request.id);
  await supabase.from("security_events").insert({
    event_type: "mark_laundry_payment_failed",
    request_id: request.id,
    detail: { reason: "stale_pending_no_callback" },
  });
  return true;
}
