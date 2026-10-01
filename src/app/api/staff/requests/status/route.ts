import { NextResponse } from "next/server";
import { getStaffApiSession } from "@/lib/staff";

// Polled by TaskList (see usePollRefresh) so staff pick up an admin setting
// a laundry price, or a payment callback marking a charge paid, without
// refreshing the tab themselves.
export async function GET(request: Request) {
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const requestType = new URL(request.url).searchParams.get("type");
  if (requestType !== "cleaning" && requestType !== "laundry") {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  const { data, error } = await session.supabase
    .from("staff_cleaning_laundry_feed")
    .select("id, status, laundry_payment_status, updated_at")
    .eq("request_type", requestType)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load status." }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
