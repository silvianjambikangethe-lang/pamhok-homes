import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  // completed_by cleared, not preserved: this is an admin action, not a
  // staff one, so any leftover staff attribution from an earlier stage
  // (e.g. a staff member marking it "In Progress") would misleadingly
  // claim a staff member made THIS transition too — same reasoning as
  // the laundry-stage admin route.
  const { data, error } = await supabase
    .from("guest_requests")
    .update({ status: "Resolved", completed_by: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not resolve request." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
