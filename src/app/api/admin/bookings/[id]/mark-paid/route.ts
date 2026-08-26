import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendPaymentSucceededEmail } from "@/lib/booking-emails";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: before } = await supabase
    .from("bookings")
    .select("paid_at")
    .eq("id", id)
    .maybeSingle();
  const wasAlreadyPaid = before?.paid_at != null;

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

  await sendPaymentSucceededEmail(supabase, id, wasAlreadyPaid);

  return NextResponse.json({ ok: true });
}
