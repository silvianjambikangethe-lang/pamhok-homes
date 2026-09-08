import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaff, getActiveWorkerId } from "@/lib/staff";
import { pageTitle } from "@/lib/site";
import TapWorkerScreen from "@/components/staff/TapWorkerScreen";
import type { StaffMember } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: pageTitle("Staff"),
  robots: { index: false, follow: false },
};

export default async function StaffTapPage() {
  const { supabase } = await requireStaff();

  const activeWorkerId = await getActiveWorkerId();
  if (activeWorkerId) {
    const { data: worker } = await supabase
      .from("staff_members")
      .select("id")
      .eq("id", activeWorkerId)
      .eq("active", true)
      .maybeSingle();
    if (worker) redirect("/staff/overview");
  }

  const { data } = await supabase
    .from("staff_members")
    .select("id, name, active, created_at")
    .eq("active", true)
    .order("name", { ascending: true });

  const workers = (data ?? []) as StaffMember[];

  return <TapWorkerScreen workers={workers} />;
}
