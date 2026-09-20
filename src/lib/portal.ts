import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { releaseExpiredExtensionHold } from "@/lib/extension-hold";
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
  latestLaundryRequest: LatestLaundryRequest | null;
  // Other rooms booked together with this one (same guest, same dates), so
  // a group can reach each room's own page to pay and verify ID.
  siblingBookings: {
    access_token: string;
    payment_status: string;
    room_name: string | null;
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
          .select("access_token, payment_status, room:rooms(name)")
          .eq("guest_id", data.guest_id)
          .eq("check_in", data.check_in)
          .eq("check_out", data.check_out)
          .neq("id", data.id)
          .neq("booking_status", "Cancelled")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const siblingBookings = (
    (siblingResult.data ?? []) as unknown as {
      access_token: string;
      payment_status: string;
      room: { name: string } | null;
    }[]
  ).map((s) => ({
    access_token: s.access_token,
    payment_status: s.payment_status,
    room_name: s.room?.name ?? null,
  }));

  // Everything returned here is serialized into the guest's page (the
  // whole booking is handed to a client component), so the secrets must be
  // withheld HERE — hiding them in the UI alone left the door code and WiFi
  // password readable in View Source before a guest had paid or been
  // verified. Server-side mirror of the portal UI's own "unlocked" rule:
  // ID-verified, paid at least once, and not yet checked out.
  const unlocked =
    data.id_verification_status === "Verified" && !!data.paid_at && !data.checked_out_at;
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
    hasReview: (count ?? 0) > 0,
    latestLaundryRequest: laundryRows?.[0] ?? null,
    siblingBookings,
  } as unknown as PortalBooking;
}
