import type { Metadata } from "next";
import { requireStaff } from "@/lib/staff";
import { pageTitle } from "@/lib/site";
import TaskList from "@/components/staff/TaskList";
import type { StaffCleaningLaundryFeedRow } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: pageTitle("Laundry Requests"),
  robots: { index: false, follow: false },
};

export default async function StaffLaundryPage() {
  const { supabase } = await requireStaff();

  const { data } = await supabase
    .from("staff_cleaning_laundry_feed")
    .select("id, request_type, status, message, created_at, completed_by, room_id, room_name")
    .eq("request_type", "laundry")
    .order("created_at", { ascending: false });

  const requests = (data ?? []) as StaffCleaningLaundryFeedRow[];

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Laundry Requests</h1>
      <div className="mt-6">
        <TaskList requestType="laundry" requests={requests} />
      </div>
    </div>
  );
}
