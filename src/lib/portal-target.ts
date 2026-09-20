import "server-only";
import type { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

export interface RequestSource {
  id: string;
  guest_id: string | null;
  check_in: string;
  check_out: string;
}

export type RequestTarget =
  | { ok: true; bookingId: string; forOtherRoom: boolean }
  | { ok: false; error: string; status: number };

const NOT_YOURS = "That room isn't part of your booking.";

// A guest who booked several rooms in one go manages all of them from any one
// room's page. A cleaning or laundry request can therefore be filed for
// another of their rooms. This decides which booking the request is saved
// against, and it is the only place that allows a request to land on a
// booking other than the one whose private link was used.
//
// The target must be a real booking that belongs to the SAME guest record and
// the SAME dates as the booking the link opened (the pair that a group
// booking creates), and it must be a confirmed, ID-verified, not-yet-checked-
// out stay. Anything else is refused, and the refusal never says whether the
// link exists, so it can't be used to probe for other guests' bookings.
export async function resolveRequestTarget(
  supabase: AdminClient,
  source: RequestSource,
  sourceToken: string,
  targetToken: unknown,
): Promise<RequestTarget> {
  if (
    typeof targetToken !== "string" ||
    targetToken.length === 0 ||
    targetToken === sourceToken
  ) {
    return { ok: true, bookingId: source.id, forOtherRoom: false };
  }

  if (targetToken.length > 64 || !source.guest_id) {
    return { ok: false, error: NOT_YOURS, status: 403 };
  }

  const { data: target } = await supabase
    .from("bookings")
    .select(
      "id, guest_id, check_in, check_out, booking_status, id_verification_status, checked_out_at",
    )
    .eq("access_token", targetToken)
    .maybeSingle();

  if (
    !target ||
    target.guest_id !== source.guest_id ||
    target.check_in !== source.check_in ||
    target.check_out !== source.check_out
  ) {
    return { ok: false, error: NOT_YOURS, status: 403 };
  }

  if (
    target.booking_status !== "Confirmed" ||
    target.id_verification_status !== "Verified" ||
    target.checked_out_at
  ) {
    return {
      ok: false,
      error: "That room isn't ready for requests yet. Its ID check and payment must be complete.",
      status: 403,
    };
  }

  return { ok: true, bookingId: target.id, forOtherRoom: true };
}
