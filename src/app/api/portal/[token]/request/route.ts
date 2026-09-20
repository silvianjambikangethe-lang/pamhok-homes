import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveRequestTarget } from "@/lib/portal-target";

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
    .select("id, guest_id, check_in, check_out, id_verification_status")
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

  // A group booking's guest can file this for any of their other rooms.
  const target = await resolveRequestTarget(supabase, booking, token, body.targetToken);
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }

  const { error: insertError } = await supabase.from("guest_requests").insert({
    booking_id: target.bookingId,
    request_type: body.requestType,
    message: typeof body.message === "string" ? body.message.slice(0, 1000) : null,
    status: "Open",
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not send request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
