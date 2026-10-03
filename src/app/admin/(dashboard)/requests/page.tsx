import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import RequestsFeed, { type RequestRow } from "@/components/admin/RequestsFeed";

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { show } = await searchParams;
  const showResolved = show === "resolved";

  // Finished requests (Resolved, or laundry that is Closed) clear off the list
  // by themselves; "Show resolved" brings the history back on demand.
  let query = supabase
    .from("guest_requests")
    .select(
      "id, request_type, message, status, created_at, updated_at, completed_by, laundry_amount, laundry_currency, laundry_payment_status, booking:bookings(booking_reference, guest:guests(full_name), room:rooms(name)), completedByStaff:staff_members(name)",
    )
    .order("created_at", { ascending: false });
  if (!showResolved) query = query.not("status", "in", "(Resolved,Closed)");

  const [{ data }, { count: resolvedCount }] = await Promise.all([
    query,
    supabase
      .from("guest_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["Resolved", "Closed"]),
  ]);

  const rows: RequestRow[] = (data ?? []).map((r) => {
    const booking = (r as unknown as {
      booking?: {
        booking_reference?: string | null;
        guest?: { full_name?: string };
        room?: { name?: string };
      };
    }).booking;
    const completedByStaff = (r as unknown as { completedByStaff?: { name?: string } | null })
      .completedByStaff;
    return {
      id: r.id,
      request_type: r.request_type,
      message: r.message,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      guestName: booking?.guest?.full_name ?? null,
      roomName: booking?.room?.name ?? null,
      bookingReference: booking?.booking_reference ?? null,
      laundryAmount: r.laundry_amount,
      laundryCurrency: r.laundry_currency,
      laundryPaymentStatus: r.laundry_payment_status,
      completedByStaffName: completedByStaff?.name ?? null,
    };
  });

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Guest Requests</h1>
      <p className="mt-1 text-sm text-ink/80">
        Room service, cleaning, and assistance calls from current guests.
      </p>
      {(resolvedCount ?? 0) > 0 && (
        <p className="mt-3 text-sm">
          <Link
            href={showResolved ? "/admin/requests" : "/admin/requests?show=resolved"}
            className="focus-ring rounded font-medium text-terracotta-600 underline hover:text-terracotta-700"
          >
            {showResolved
              ? "Hide resolved requests"
              : `Show resolved requests (${resolvedCount})`}
          </Link>
        </p>
      )}
      <div className="mt-6">
        <RequestsFeed requests={rows} showingResolved={showResolved} />
      </div>
    </div>
  );
}
