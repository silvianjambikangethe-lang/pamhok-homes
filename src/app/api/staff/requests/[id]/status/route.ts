import { NextResponse } from "next/server";
import { getStaffApiSession, getActiveWorkerId } from "@/lib/staff";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendEmail, laundryStatusEmail } from "@/lib/email";
import type { GuestRequestStatus, GuestRequestType } from "@/lib/supabase/types";

const ALLOWED_STATUS: Record<string, readonly GuestRequestStatus[]> = {
  cleaning: ["Open", "In Progress", "Resolved"],
  laundry: ["Open", "Picked Up", "Cleaning", "Ready", "Returned", "Closed"],
};

// Same four stages that trigger a guest email on the admin side (see
// /api/admin/requests/[id]/laundry-stage) — kept identical so the guest
// experience doesn't differ by who advanced the stage.
const NOTIFY_STAGES = new Set(["Picked Up", "Cleaning", "Ready", "Returned"]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const { supabase } = session;
  const workerId = await getActiveWorkerId();

  if (!workerId) {
    return NextResponse.json({ error: "No active worker selected." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  const requestType = body?.requestType as GuestRequestType | undefined;

  if (
    typeof status !== "string" ||
    !requestType ||
    !ALLOWED_STATUS[requestType]?.includes(status as GuestRequestStatus)
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // Through staff_task_updates — a column-restricted view, so this can
  // only ever touch status/completed_by, never message/booking_id.
  const { data, error } = await supabase
    .from("staff_task_updates")
    .update({ status: status as GuestRequestStatus, completed_by: workerId })
    .eq("id", id)
    .eq("request_type", requestType)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not update status." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
  }

  // A staff session has no RLS path to guest_requests/bookings/guests at
  // all (by design), so the guest-notification lookup below must go
  // through the service-role client — reusing the session client here
  // would silently just return nothing and the email would never send.
  if (requestType === "laundry" && NOTIFY_STAGES.has(status)) {
    const adminClient = createAdminSupabaseClient();
    const { data: guestRequest } = await adminClient
      .from("guest_requests")
      .select("booking_id")
      .eq("id", id)
      .maybeSingle();

    if (guestRequest?.booking_id) {
      const { data: booking } = await adminClient
        .from("bookings")
        .select("access_token, guest:guests(full_name, email)")
        .eq("id", guestRequest.booking_id)
        .maybeSingle();

      const guest = booking?.guest as unknown as { full_name: string; email: string | null } | null;
      if (guest?.email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
        const { subject, html } = laundryStatusEmail({
          guestName: guest.full_name,
          stage: status as "Picked Up" | "Cleaning" | "Ready" | "Returned",
          portalUrl: `${siteUrl}/portal/${booking!.access_token}`,
        });
        await sendEmail({ to: guest.email, subject, html });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
