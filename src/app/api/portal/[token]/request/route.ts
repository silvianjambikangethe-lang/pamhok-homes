import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const VALID_TYPES = ["cleaning", "assistance", "other"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !VALID_TYPES.includes(body.requestType)) {
    return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, id_verification_status")
    .eq("access_token", token)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (booking.id_verification_status !== "Verified") {
    return NextResponse.json(
      { error: "Available once your ID has been verified." },
      { status: 403 },
    );
  }

  const { error: insertError } = await supabase.from("guest_requests").insert({
    booking_id: booking.id,
    request_type: body.requestType,
    message: typeof body.message === "string" ? body.message.slice(0, 1000) : null,
    status: "Open",
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not send request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
