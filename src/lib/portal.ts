import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { releaseExpiredExtensionHold } from "@/lib/extension-hold";
import { isStayOver } from "@/lib/stay-expiry";
import { completeCheckout } from "@/lib/checkout";
import { expireStaleBookingPayment, expireStaleLaundryPayment } from "@/lib/pending-payment-expiry";
import type { Booking, Guest, LaundryPaymentStatus, Room } from "@/lib/supabase/types";

export interface LatestLaundryRequest {
  id: string;
  status: string;
  created_at: string;
  laundry_amount: number | null;
  laundry_currency: string | null;
  laundry_payment_status: LaundryPaymentStatus | null;
}

export interface PortalBooking extends Booking {
  room: Pick<Room, "id" | "name" | "slug" | "door_code" | "wifi_password" | "wifi_network_name"> | null;
  guest: Pick<Guest, "full_name"> | null;
  hasReview: boolean;
  // True for exactly one page load: the one right after a stay-extension
  // payment resolved. Read once here and cleared in the same request, so
  // the guest sees "your extension payment has been received" exactly
  // once instead of it lingering on every reload for the rest of the stay.
  extensionJustConfirmed: boolean;
  latestLaundryRequest: LatestLaundryRequest | null;
  // Other rooms booked together with this one (same guest, same dates), so
  // a group can reach each room's own page to pay and verify ID.
  siblingBookings: {
    access_token: string;
    payment_status: string;
    room_name: string | null;
    // Whether this room can take a cleaning or laundry request yet.
    ready: boolean;
  }[];
}

// The guest portal has no login — the access_token in the URL *is* the
// credential (a long, unguessable UUID emailed/shown at booking time).
// This must run server-side with the service-role key: bookings carry ID
// document paths, so there is deliberately no public RLS SELECT policy
// on the table for the anon key to use here.
export async function getBookingByToken(token: string): Promise<PortalBooking | null> {
  const supabase = createAdminSupabaseClient();

  let { data, error } = await supabase
    .from("bookings")
    .select(
      "*, room:rooms(id, name, slug, door_code, wifi_password, wifi_network_name), guest:guests(full_name)",
    )
    .eq("access_token", token)
    .maybeSingle();

  if (error || !data) return null;

  if (await releaseExpiredExtensionHold(supabase, data)) {
    ({ data, error } = await supabase
      .from("bookings")
      .select(
        "*, room:rooms(id, name, slug, door_code, wifi_password, wifi_network_name), guest:guests(full_name)",
      )
      .eq("access_token", token)
      .maybeSingle());
    if (error || !data) return null;
  }

  // Same self-healing idea as releaseExpiredExtensionHold above, for a
  // first-time booking payment abandoned mid-Jenga-checkout: flips a stale
  // "Pending" booking to "Failed" the moment anyone next loads this page,
  // instead of waiting on the once-daily expire-pending-payments cron (a
  // no-op unless the booking is genuinely Pending and unpaid).
  if (await expireStaleBookingPayment(supabase, data)) {
    ({ data, error } = await supabase
      .from("bookings")
      .select(
        "*, room:rooms(id, name, slug, door_code, wifi_password, wifi_network_name), guest:guests(full_name)",
      )
      .eq("access_token", token)
      .maybeSingle());
    if (error || !data) return null;
  }

  // Auto check-out: once the stay is over, close it out (ID photos and phone
  // deleted) even if the guest never tapped Check Out. Skipped while an
  // extension is awaiting payment.
  if (needsAutoCheckout(data)) {
    const outcome = await completeCheckout(supabase, { bookingId: data.id });
    if (outcome.ok) data = { ...data, checked_out_at: new Date().toISOString() };
  }

  // Read-and-clear: this is the one page load where the guest should see
  // "your extension payment has been received" instead of the ordinary
  // check-in confirmation card. Cleared immediately so a later reload
  // doesn't keep showing it.
  const extensionJustConfirmed = !!data.extension_confirmed_at;
  if (extensionJustConfirmed) {
    await supabase.from("bookings").update({ extension_confirmed_at: null }).eq("id", data.id);
  }

  const [{ count }, { data: laundryRows }, siblingResult] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("booking_id", data.id),
    supabase
      .from("guest_requests")
      .select("id, status, created_at, laundry_amount, laundry_currency, laundry_payment_status")
      .eq("booking_id", data.id)
      .eq("request_type", "laundry")
      .order("created_at", { ascending: false })
      .limit(1),
    data.guest_id
      ? supabase
          .from("bookings")
          .select("access_token, payment_status, booking_status, id_verification_status, checked_out_at, room:rooms(name)")
          .eq("guest_id", data.guest_id)
          .eq("check_in", data.check_in)
          .eq("check_out", data.check_out)
          .neq("id", data.id)
          .neq("booking_status", "Cancelled")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  // Same idea as the booking check above, for a laundry charge abandoned
  // mid-Jenga-checkout. The row is already in hand, so just patch its status
  // in memory instead of re-querying — nothing else in `laundryRows[0]`
  // changes when this flips.
  const latestLaundry = laundryRows?.[0] ?? null;
  if (latestLaundry && (await expireStaleLaundryPayment(supabase, latestLaundry))) {
    latestLaundry.laundry_payment_status = "Failed";
  }

  const siblingBookings = (
    (siblingResult.data ?? []) as unknown as {
      access_token: string;
      payment_status: string;
      booking_status: string;
      id_verification_status: string;
      checked_out_at: string | null;
      room: { name: string } | null;
    }[]
  ).map((s) => ({
    access_token: s.access_token,
    payment_status: s.payment_status,
    room_name: s.room?.name ?? null,
    ready:
      s.booking_status === "Confirmed" &&
      s.id_verification_status === "Verified" &&
      !s.checked_out_at,
  }));

  // Everything returned here is serialized into the guest's page (the
  // whole booking is handed to a client component), so the secrets must be
  // withheld HERE — hiding them in the UI alone left the door code and WiFi
  // password readable in View Source before a guest had paid or been
  // verified. Server-side mirror of the portal UI's own "unlocked" rule:
  // ID-verified, paid at least once, and the stay not over (checked out, or
  // past the check-out cutoff for a guest who never tapped Check Out).
  const unlocked =
    data.id_verification_status === "Verified" && !!data.paid_at && !isStayOver(data);
  const room = data.room as unknown as PortalBooking["room"];

  return {
    ...data,
    room: room && !unlocked
      ? { ...room, door_code: null, wifi_password: null, wifi_network_name: null }
      : room,
    // Data minimisation: the portal never displays these, so don't send a
    // guest's own ID-photo storage paths, the OCR'd contents of their ID, or
    // the internal refund reference to the browser. (payment_reference is
    // deliberately kept: it's printed on the guest's own receipt.)
    id_document_path: null,
    id_document_back_path: null,
    id_document_path_2: null,
    id_document_back_path_2: null,
    id_document_url: null,
    id_verification_result: null,
    id_verification_result_2: null,
    refund_reference: null,
    extensionJustConfirmed,
    hasReview: (count ?? 0) > 0,
    latestLaundryRequest: latestLaundry,
    siblingBookings,
  } as unknown as PortalBooking;
}

// What the public "Verified Guest" page needs, and nothing more. Looked up by
// booking id from a SIGNED pass code (see verify-token.ts), never by the
// private portal link.
export interface VerificationSummary {
  payment_status: string;
  id_verification_status: string;
  booking_status: string;
  checked_out_at: string | null;
  check_in: string;
  check_out: string;
  booking_reference: string | null;
  room: { name: string } | null;
  guest: { full_name: string } | null;
}

export async function getVerificationSummary(bookingId: string): Promise<VerificationSummary | null> {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, pending_extension_check_out, payment_status, id_verification_status, booking_status, checked_out_at, check_in, check_out, booking_reference, room:rooms(name), guest:guests(full_name)",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!data) return null;
  // Same auto check-out as the portal, for a pass scanned before anyone
  // opened the guest's page.
  if (needsAutoCheckout(data)) {
    await completeCheckout(supabase, { bookingId: data.id });
  }
  return data as unknown as VerificationSummary;
}

// Only a paid, live stay is auto-checked-out: a cancelled or never-paid
// booking has no guest to thank and nothing to close out.
function needsAutoCheckout(b: {
  checked_out_at: string | null;
  pending_extension_check_out: string | null;
  payment_status: string;
  booking_status: string;
  check_out: string;
}): boolean {
  return (
    !b.checked_out_at &&
    !b.pending_extension_check_out &&
    b.payment_status === "Paid" &&
    b.booking_status !== "Cancelled" &&
    isStayOver(b)
  );
}
