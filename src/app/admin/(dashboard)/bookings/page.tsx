import { format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import BookingsTable, { type AdminBookingRow } from "@/components/admin/BookingsTable";
import BlockDatesForm from "@/components/admin/BlockDatesForm";
import ManualBookingForm from "@/components/admin/ManualBookingForm";
import RoomStatusGrid, { type RoomStatus } from "@/components/admin/RoomStatusGrid";
import SecurityEventsList, {
  type SecurityEventRow,
} from "@/components/admin/SecurityEventsList";

export default async function AdminBookingsPage() {
  const supabase = await createServerSupabaseClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const [{ data: bookings }, { data: rooms }, { data: activeStays }, { data: securityEvents }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, booking_reference, check_in, check_out, total_amount, currency, payment_status, booking_status, refund_status, guest:guests(full_name), room:rooms(name)",
        )
        .order("check_in", { ascending: false }),
      supabase.from("rooms").select("id, name").eq("is_active", true).order("display_order"),
      // Room Status grid: whichever booking currently has a guest checked
      // in - Confirmed, not yet checked out, and today falls within the
      // stay (inclusive of checkout day, since they haven't left until
      // they actually confirm checkout).
      supabase
        .from("bookings")
        .select("id, room_id, check_out, guest:guests(full_name, phone)")
        .eq("booking_status", "Confirmed")
        .is("checked_out_at", null)
        .lte("check_in", today)
        .gte("check_out", today),
      // Security Log: every automatic payment-marking event (see the
      // guest_payment_rpc_functions migration) — a history of individual
      // events, not a status snapshot like the bookings list above, so a
      // duplicate/unusual payment event is visible even if the booking's
      // current payment_status looks perfectly normal.
      supabase
        .from("security_events")
        .select(
          "id, event_type, booking_id, request_id, detail, created_at, booking:bookings(booking_reference)",
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const stayByRoomId = new Map(
    (activeStays ?? []).map((b) => [
      b.room_id,
      {
        bookingId: b.id,
        guestName: (b as unknown as { guest?: { full_name?: string } }).guest?.full_name ?? null,
        guestPhone: (b as unknown as { guest?: { phone?: string } }).guest?.phone ?? null,
        checkOut: b.check_out,
      },
    ]),
  );

  const roomStatuses: RoomStatus[] = (rooms ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    bookingId: stayByRoomId.get(room.id)?.bookingId ?? null,
    guestName: stayByRoomId.get(room.id)?.guestName ?? null,
    guestPhone: stayByRoomId.get(room.id)?.guestPhone ?? null,
    checkOut: stayByRoomId.get(room.id)?.checkOut ?? null,
  }));

  const rows: AdminBookingRow[] = (bookings ?? []).map((b) => ({
    id: b.id,
    booking_reference: b.booking_reference,
    check_in: b.check_in,
    check_out: b.check_out,
    total_amount: Number(b.total_amount),
    currency: b.currency,
    payment_status: b.payment_status,
    booking_status: b.booking_status,
    refund_status: b.refund_status,
    guestName:
      (b as unknown as { guest?: { full_name?: string } }).guest?.full_name ?? null,
    roomName: (b as unknown as { room?: { name?: string } }).room?.name ?? null,
  }));

  const securityEventRows: SecurityEventRow[] = (securityEvents ?? []).map((e) => {
    const booking = (e as unknown as { booking?: { booking_reference?: string | null } | null })
      .booking;
    return {
      id: e.id,
      event_type: e.event_type,
      booking_id: e.booking_id,
      request_id: e.request_id,
      detail: e.detail as Record<string, unknown> | null,
      created_at: e.created_at,
      bookingReference: booking?.booking_reference ?? null,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-h2 text-ink">Bookings</h1>
        <p className="mt-1 text-sm text-ink/80">
          All confirmed, cancelled, and blocked dates across every room.
        </p>
      </div>

      <RoomStatusGrid rooms={roomStatuses} />

      <BookingsTable bookings={rows} />

      <ManualBookingForm rooms={rooms ?? []} />

      <BlockDatesForm rooms={rooms ?? []} />

      <div>
        <h2 className="font-serif text-h3 text-ink">Security Log</h2>
        <p className="mt-1 text-sm text-ink/80">
          Every automatic payment-marking event, most recent first. Watch for the same booking
          appearing repeatedly or amounts that don&apos;t look right.
        </p>
        <SecurityEventsList events={securityEventRows} />
      </div>
    </div>
  );
}
