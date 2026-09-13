import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendEmail, laundryStatusEmail } from "@/lib/email";
import type { GuestRequestStatus } from "@/lib/supabase/types";

const STAGES: readonly GuestRequestStatus[] = [
  "Open",
  "Picked Up",
  "Cleaning",
  "Ready",
  "Awaiting Payment",
  "Returned",
  "Closed",
];

// Only these four stages are worth a guest-facing email — "Open" is the
// moment the guest themselves made the request (they already know), and
// "Closed" is an internal admin bookkeeping state.
const NOTIFY_STAGES = new Set(["Picked Up", "Cleaning", "Ready", "Returned"]);

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

  // "Awaiting Payment" only ever gets set as one atomic step together
  // with an actual amount — see /api/admin/requests/[id]/laundry-price —
  // never through this generic stage picker, which would otherwise leave
  // a guest looking at "payment due" with no amount and no way to pay.
  // "Returned" requires that charge to have actually been paid first.
  if (stage === "Awaiting Payment") {
    return NextResponse.json(
      { error: "Set a price to move this to Awaiting Payment." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();

  if (stage === "Returned") {
    const { data: current } = await supabase
      .from("guest_requests")
      .select("laundry_payment_status")
      .eq("id", id)
      .eq("request_type", "laundry")
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
    }
    if (current.laundry_payment_status !== "Paid") {
      return NextResponse.json(
        { error: "This laundry charge hasn't been paid yet." },
        { status: 409 },
      );
    }
  }

  // completed_by cleared, not preserved: this is an admin action, not a
  // staff one, so any leftover staff attribution from an earlier stage
  // would misleadingly claim a staff member made THIS transition too.
  const { data, error } = await supabase
    .from("guest_requests")
    .update({ status: stage, completed_by: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("request_type", "laundry")
    .select("id, booking_id");

  if (error) {
    return NextResponse.json({ error: "Could not update stage." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
  }

  if (NOTIFY_STAGES.has(stage)) {
    const bookingId = data[0].booking_id;
    const { data: booking } = await supabase
      .from("bookings")
      .select("access_token, guest:guests(full_name, email)")
      .eq("id", bookingId)
      .maybeSingle();

    const guest = booking?.guest as unknown as { full_name: string; email: string | null } | null;
    if (guest?.email) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const { subject, html } = laundryStatusEmail({
        guestName: guest.full_name,
        stage: stage as "Picked Up" | "Cleaning" | "Ready" | "Returned",
        portalUrl: `${siteUrl}/portal/${booking!.access_token}`,
      });
      await sendEmail({ to: guest.email, subject, html });
    }
  }

  return NextResponse.json({ ok: true });
}
