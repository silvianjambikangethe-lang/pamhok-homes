import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { pageTitle } from "@/lib/site";
import StaffShiftBoard from "@/components/admin/StaffShiftBoard";

export const metadata: Metadata = {
  title: pageTitle("Staff Shifts"),
  robots: { index: false, follow: false },
};

type ShiftRow = {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  staff_member: { name: string } | null;
};

export default async function AdminStaffPage() {
  const { supabase } = await requireAdmin();

  // Admins have read access to shift_logs (see "admins view shift logs"
  // RLS policy) — this is the session client, not service-role, since
  // that policy is exactly what's meant to gate this page's data.
  const { data } = await supabase
    .from("shift_logs")
    .select("id, clock_in_at, clock_out_at, staff_member:staff_members(name)")
    .order("clock_in_at", { ascending: false })
    .limit(50);

  const shifts = (data ?? []) as unknown as ShiftRow[];
  const clockedIn = shifts.filter((s) => s.clock_out_at === null);

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Staff Shifts</h1>
      <p className="mt-1 text-sm text-ink/70">
        Who&apos;s currently clocked in, and recent clock in/out history from the maintenance
        staff dashboard.
      </p>

      <StaffShiftBoard clockedIn={clockedIn} shifts={shifts} />
    </div>
  );
}
