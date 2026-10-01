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

async function markBookingFailed(supabase: AdminClient, bookingId: string): Promise<void> {
  await supabase.from("bookings").update({ payment_status: "Failed" }).eq("id", bookingId);
  await supabase.from("security_events").insert({
    event_type: "mark_booking_payment_failed",
    booking_id: bookingId,
    detail: { reason: "stale_pending_no_callback" },
  });
}

async function markLaundryFailed(supabase: AdminClient, requestId: string, now: Date): Promise<void> {
  await supabase
    .from("guest_requests")
    .update({ laundry_payment_status: "Failed", updated_at: now.toISOString() })
    .eq("id", requestId);
  await supabase.from("security_events").insert({
    event_type: "mark_laundry_payment_failed",
    request_id: requestId,
    detail: { reason: "stale_pending_no_callback" },
  });
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
// Safe to call on every booking read (e.g. getBookingByToken) — a no-op
// unless genuinely stale. One booking at a time, so one payment_attempts
// query is fine here; expireStaleBookingPaymentsBatch below is the version
// for checking many bookings at once (the cron) without an N+1 query per row.
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

  await markBookingFailed(supabase, booking.id);
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

  await markLaundryFailed(supabase, request.id, now);
  return true;
}

// Builds id -> most-recent payment_attempts.created_at for a batch of ids in
// ONE query (ordered descending, so the first row seen per id while scanning
// top to bottom is necessarily that id's latest) instead of one query per id.
async function latestAttemptByIdBatch(
  supabase: AdminClient,
  column: "booking_id" | "request_id",
  ids: string[],
): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  if (ids.length === 0) return latest;

  const { data } = await supabase
    .from("payment_attempts")
    .select(`${column}, created_at`)
    .in(column, ids)
    .order("created_at", { ascending: false });

  for (const row of (data ?? []) as { booking_id?: string | null; request_id?: string | null; created_at: string }[]) {
    const id = row[column];
    if (id && !latest.has(id)) latest.set(id, row.created_at);
  }
  return latest;
}

// Batched version of expireStaleBookingPayment for the daily cron — two
// queries total (one to fetch every candidate's latest payment attempt, one
// per actually-stale row to mark it Failed) instead of one read query per
// pending booking.
export async function expireStaleBookingPaymentsBatch(
  supabase: AdminClient,
  bookings: { id: string; payment_status: string; paid_at: string | null; created_at: string }[],
  now: Date = new Date(),
): Promise<number> {
  const candidates = bookings.filter((b) => b.payment_status === "Pending" && !b.paid_at);
  if (candidates.length === 0) return 0;

  const latestById = await latestAttemptByIdBatch(
    supabase,
    "booking_id",
    candidates.map((b) => b.id),
  );

  let expired = 0;
  for (const booking of candidates) {
    const referenceTime = latestById.get(booking.id) ?? booking.created_at;
    if (isStale(referenceTime, now)) {
      await markBookingFailed(supabase, booking.id);
      expired++;
    }
  }
  return expired;
}

// Batched version of expireStaleLaundryPayment for the daily cron.
export async function expireStaleLaundryPaymentsBatch(
  supabase: AdminClient,
  requests: { id: string; laundry_payment_status: string | null; created_at: string }[],
  now: Date = new Date(),
): Promise<number> {
  const candidates = requests.filter((r) => r.laundry_payment_status === "Pending");
  if (candidates.length === 0) return 0;

  const latestById = await latestAttemptByIdBatch(
    supabase,
    "request_id",
    candidates.map((r) => r.id),
  );

  let expired = 0;
  for (const request of candidates) {
    const referenceTime = latestById.get(request.id) ?? request.created_at;
    if (isStale(referenceTime, now)) {
      await markLaundryFailed(supabase, request.id, now);
      expired++;
    }
  }
  return expired;
}
