import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  // No manual admin check here: the "admins manage bookings" RLS policy
  // means this UPDATE simply affects 0 rows for a non-admin session.
  const { data, error } = await supabase
    .from("bookings")
    .update({
      payment_status: "Paid",
      payment_method: "manual",
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not update booking." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or booking not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
