import { createServerSupabaseClient } from "@/lib/supabase/server";
import BookingsTable, { type AdminBookingRow } from "@/components/admin/BookingsTable";
import BlockDatesForm from "@/components/admin/BlockDatesForm";

export default async function AdminBookingsPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: bookings }, { data: rooms }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, booking_reference, check_in, check_out, total_amount, currency, payment_status, booking_status, refund_status, guest:guests(full_name), room:rooms(name)",
      )
      .order("check_in", { ascending: false }),
    supabase.from("rooms").select("id, name").eq("is_active", true),
  ]);

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-h2 text-ink">Bookings</h1>
        <p className="mt-1 text-sm text-ink/80">
          All confirmed, cancelled, and blocked dates across every room.
        </p>
      </div>

      <BookingsTable bookings={rows} />

      <BlockDatesForm rooms={rooms ?? []} />
    </div>
  );
}
