import { redirect } from "next/navigation";
import { requireStaff, getActiveWorkerId } from "@/lib/staff";
import StaffNav from "@/components/staff/StaffNav";

export default async function StaffDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase } = await requireStaff();

  const workerId = await getActiveWorkerId();
  if (!workerId) redirect("/staff");

  // Re-validated against staff_members.active on every load (not just at
  // tap time) — so the host deactivating a worker mid-shift takes effect
  // immediately, not just at their next login.
  const { data: worker } = await supabase
    .from("staff_members")
    .select("id, name")
    .eq("id", workerId)
    .eq("active", true)
    .maybeSingle();

  if (!worker) redirect("/staff");

  // Same "plain count query on page load, no realtime" convention as the
  // admin Overview page's badge.
  const { count } = await supabase
    .from("staff_cleaning_laundry_feed")
    .select("id", { count: "exact", head: true })
    .not("status", "in", '("Resolved","Closed")');

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col lg:flex-row">
      <aside className="w-full bg-forest-700 dark:bg-[#191410] lg:w-64 lg:shrink-0">
        <StaffNav workerName={worker.name} openCount={count ?? 0} />
      </aside>
      <div className="flex-1 bg-page p-6 sm:p-10">{children}</div>
    </div>
  );
}
