import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.roomId !== "string" ||
    typeof body.checkIn !== "string" ||
    typeof body.checkOut !== "string"
  ) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Optional precise start/end for this block, already computed client-side
  // (in the admin's own local time, see BlockDatesForm.tsx) — null for a
  // plain whole-day block. check_in/check_out above stay the only thing
  // availability math reads; these are purely the Room Status grid's
  // "confirm release" signal.
  if (typeof body.blockStartAt !== "undefined" && body.blockStartAt !== null && typeof body.blockStartAt !== "string") {
    return NextResponse.json({ error: "Invalid start time." }, { status: 400 });
  }
  if (typeof body.blockEndAt !== "undefined" && body.blockEndAt !== null && typeof body.blockEndAt !== "string") {
    return NextResponse.json({ error: "Invalid end time." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      room_id: body.roomId,
      check_in: body.checkIn,
      check_out: body.checkOut,
      total_amount: 0,
      currency: "KES",
      booking_status: "Blocked",
      block_note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
      block_start_at: body.blockStartAt ?? null,
      block_end_at: body.blockEndAt ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Not authorized, or dates overlap an existing booking." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
