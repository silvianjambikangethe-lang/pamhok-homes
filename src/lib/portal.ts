import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Booking, Guest, Room } from "@/lib/supabase/types";

export interface LatestLaundryRequest {
  id: string;
  status: string;
  created_at: string;
}

export interface PortalBooking extends Booking {
  room: Pick<Room, "id" | "name" | "slug" | "door_code" | "wifi_password"> | null;
  guest: Pick<Guest, "full_name"> | null;
  hasReview: boolean;
  latestLaundryRequest: LatestLaundryRequest | null;
}

// The guest portal has no login — the access_token in the URL *is* the
// credential (a long, unguessable UUID emailed/shown at booking time).
// This must run server-side with the service-role key: bookings carry ID
// document paths, so there is deliberately no public RLS SELECT policy
// on the table for the anon key to use here.
export async function getBookingByToken(token: string): Promise<PortalBooking | null> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("*, room:rooms(id, name, slug, door_code, wifi_password), guest:guests(full_name)")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !data) return null;

  const [{ count }, { data: laundryRows }] = await Promise.all([
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("booking_id", data.id),
    supabase
      .from("guest_requests")
      .select("id, status, created_at")
      .eq("booking_id", data.id)
      .eq("request_type", "laundry")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return {
    ...data,
    hasReview: (count ?? 0) > 0,
    latestLaundryRequest: laundryRows?.[0] ?? null,
  } as unknown as PortalBooking;
}
