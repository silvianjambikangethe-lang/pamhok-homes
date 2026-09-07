import type { Metadata } from "next";
import { requireStaff, getActiveWorkerId } from "@/lib/staff";
import { pageTitle } from "@/lib/site";
import ClockToggle from "@/components/staff/ClockToggle";

export const metadata: Metadata = {
  title: pageTitle("Clock In/Out"),
  robots: { index: false, follow: false },
};

export default async function StaffClockPage() {
  const { supabase } = await requireStaff();
  const workerId = await getActiveWorkerId();

  const { data: openShift } = await supabase
    .from("staff_clock_updates")
    .select("id, staff_member_id, clock_in_at, clock_out_at")
    .eq("staff_member_id", workerId ?? "")
    .maybeSingle();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-serif text-h2 text-ink">Clock In/Out</h1>
      <div className="mt-6">
        <ClockToggle clockedIn={Boolean(openShift)} clockInAt={openShift?.clock_in_at ?? null} />
      </div>
    </div>
  );
}
