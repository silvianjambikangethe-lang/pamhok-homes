import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("guest_requests")
    .update({ status: "Resolved" })
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
