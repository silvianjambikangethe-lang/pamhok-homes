import type { Metadata } from "next";
import { requireStaff } from "@/lib/staff";
import { pageTitle } from "@/lib/site";
import CleaningScheduleList from "@/components/staff/CleaningScheduleList";
import type { StaffCheckoutScheduleRow } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: pageTitle("Cleaning Schedule"),
  robots: { index: false, follow: false },
};

export default async function StaffSchedulePage() {
  const { supabase } = await requireStaff();

  const { data } = await supabase
    .from("staff_checkout_schedule")
    .select("booking_id, room_id, room_name, check_out, cleaning_request_id, cleaning_status")
    .order("check_out", { ascending: true });

  const items = (data ?? []) as StaffCheckoutScheduleRow[];

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Cleaning Schedule</h1>
      <p className="mt-1.5 text-sm text-ink/65">Checkouts happening today and tomorrow.</p>
      <div className="mt-6">
        <CleaningScheduleList items={items} />
      </div>
    </div>
  );
}
