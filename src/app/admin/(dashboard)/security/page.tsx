import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { pageTitle } from "@/lib/site";
import SecurityEventsList, {
  type SecurityEventRow,
} from "@/components/admin/SecurityEventsList";

export const metadata: Metadata = {
  title: pageTitle("Security Log"),
  robots: { index: false, follow: false },
};

export default async function AdminSecurityPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("security_events")
    .select("id, event_type, booking_id, request_id, detail, created_at, booking:bookings(booking_reference)")
    .order("created_at", { ascending: false })
    .limit(100);

  const events: SecurityEventRow[] = (data ?? []).map((e) => {
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
    <div>
      <h1 className="font-serif text-h2 text-ink">Security Log</h1>
      <p className="mt-1 text-sm text-ink/80">
        Every time a guest-facing payment callback marks a booking or laundry charge paid or
        failed, it&apos;s recorded here — the most recent 100 events. Watch for the same booking
        appearing repeatedly or amounts that don&apos;t look right.
      </p>
      <div className="mt-6">
        <SecurityEventsList events={events} />
      </div>
    </div>
  );
}
