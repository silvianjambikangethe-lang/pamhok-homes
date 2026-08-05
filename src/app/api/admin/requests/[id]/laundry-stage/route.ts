import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GuestRequestStatus } from "@/lib/supabase/types";

const STAGES: readonly GuestRequestStatus[] = [
  "Open",
  "Picked Up",
  "Cleaning",
  "Ready",
  "Returned",
  "Closed",
];

function isValidStage(value: string): value is GuestRequestStatus {
  return (STAGES as readonly string[]).includes(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const stage = body?.stage;

  if (typeof stage !== "string" || !isValidStage(stage)) {
    return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("guest_requests")
    .update({ status: stage })
    .eq("id", id)
    .eq("request_type", "laundry")
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not update stage." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
