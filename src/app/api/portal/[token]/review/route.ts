import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const rating = Number(body?.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, checked_out_at, guest:guests(full_name)")
    .eq("access_token", token)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (!booking.checked_out_at) {
    return NextResponse.json(
      { error: "Reviews open once your stay is complete." },
      { status: 403 },
    );
  }

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", booking.id)
    .maybeSingle();

  if (existingReview) {
    return NextResponse.json({ error: "You've already reviewed this stay." }, { status: 409 });
  }

  const guestName = (booking as unknown as { guest?: { full_name?: string } }).guest?.full_name;
  const displayName = guestName ? `${guestName.split(" ")[0]} ${guestName.split(" ")[1]?.[0] ?? ""}.`.trim() : null;

  const { error: insertError } = await supabase.from("reviews").insert({
    booking_id: booking.id,
    rating,
    comment: typeof body.comment === "string" ? body.comment.slice(0, 2000) : null,
    guest_display_name: displayName,
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not save review." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
