import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPaypalAccessToken, refundPaypalCapture } from "@/lib/paypal";
import type { Booking } from "@/lib/supabase/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (status !== "Verified" && status !== "Rejected") {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, booking_status, payment_status, payment_method, payment_reference, total_amount")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !booking) {
    return NextResponse.json({ error: "Not authorized or booking not found." }, { status: 403 });
  }

  if (status === "Verified") {
    const update: Partial<Booking> = {
      id_verification_status: "Verified",
      id_verification_method: "manual_override",
    };
    if (booking.booking_status === "Pending Verification") {
      update.booking_status = "Confirmed";
    }

    const { error } = await supabase.from("bookings").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Could not update verification status." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // status === "Rejected" — decline the booking and free the calendar.
  // Only attempt a refund if money was actually received. A refund that
  // needs manual attention (M-Pesa has no refund API, or a PayPal attempt
  // failed) shows up on the dashboard's "Refunds needed" card — no
  // separate alert to send, that card already reads refund_status directly.
  const rejectUpdate: Partial<Booking> = {
    id_verification_status: "Rejected",
    booking_status: "Cancelled",
  };

  if (booking.payment_status === "Paid") {
    const amount = Number(booking.total_amount);

    if (booking.payment_method === "paypal" && booking.payment_reference) {
      try {
        const accessToken = await getPaypalAccessToken();
        const result = await refundPaypalCapture(accessToken, booking.payment_reference);
        if (result.ok) {
          rejectUpdate.payment_status = "Refunded";
          rejectUpdate.refund_reference = result.refundId;
          rejectUpdate.refund_amount = amount;
          rejectUpdate.refunded_at = new Date().toISOString();
        } else {
          rejectUpdate.refund_status = "Refund Failed";
        }
      } catch {
        rejectUpdate.refund_status = "Refund Failed";
      }
    } else {
      // M-Pesa (no refund API wired up) or an unexpected/missing method —
      // flag for the admin to refund by hand.
      rejectUpdate.refund_status = "Needs Manual Refund";
    }
  }

  const { error: updateError } = await supabase.from("bookings").update(rejectUpdate).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: "Could not update verification status." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
