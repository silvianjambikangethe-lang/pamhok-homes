import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Polled by RequestsFeed (see usePollRefresh) so the admin dashboard picks
// up a staff member advancing a stage, or a payment callback marking a
// laundry charge paid, without the admin refreshing the tab themselves.
// RLS (same as the page itself) scopes this to admin-visible rows only.
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("guest_requests")
    .select("id, status, laundry_payment_status, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load status." }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
