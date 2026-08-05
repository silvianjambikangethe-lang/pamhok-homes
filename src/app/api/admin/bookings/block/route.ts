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
