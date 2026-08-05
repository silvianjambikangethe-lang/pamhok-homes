import { createServerSupabaseClient } from "@/lib/supabase/server";
import RequestsFeed, { type RequestRow } from "@/components/admin/RequestsFeed";

export default async function AdminRequestsPage() {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("guest_requests")
    .select(
      "id, request_type, message, status, created_at, booking:bookings(booking_reference, guest:guests(full_name), room:rooms(name))",
    )
    .order("created_at", { ascending: false });

  const rows: RequestRow[] = (data ?? []).map((r) => {
    const booking = (r as unknown as {
      booking?: {
        booking_reference?: string | null;
        guest?: { full_name?: string };
        room?: { name?: string };
      };
    }).booking;
    return {
      id: r.id,
      request_type: r.request_type,
      message: r.message,
      status: r.status,
      created_at: r.created_at,
      guestName: booking?.guest?.full_name ?? null,
      roomName: booking?.room?.name ?? null,
      bookingReference: booking?.booking_reference ?? null,
    };
  });

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Guest Requests</h1>
      <p className="mt-1 text-sm text-ink/80">
        Room service, cleaning, and assistance calls from current guests.
      </p>
      <div className="mt-6">
        <RequestsFeed requests={rows} />
      </div>
    </div>
  );
}
