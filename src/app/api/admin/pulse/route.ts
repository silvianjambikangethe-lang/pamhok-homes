import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Polled by LivePulse (mounted once in the admin layout) so EVERY admin page
// picks up what guests do (new bookings, payments, ID uploads, requests,
// reviews, check-outs, extensions) without a manual refresh. Returns only a
// short fingerprint of the current state, not the data: the page itself is
// re-fetched through the normal server render only when the fingerprint
// changes. Admin-only, same gate as the dashboard.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const [bookings, requests, reviews] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, booking_status, payment_status, id_verification_status, id_verification_attempts, checked_out_at, check_in, check_out, total_amount, pending_extension_check_out, refund_status, id_document_path, id_document_path_2",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("guest_requests")
      .select("id, status, laundry_payment_status, updated_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  if (bookings.error || requests.error || reviews.error) {
    return NextResponse.json({ error: "Could not load status." }, { status: 500 });
  }

  const fingerprint = createHash("sha1")
    .update(JSON.stringify([bookings.data, requests.data, reviews.data]))
    .digest("hex");
  return NextResponse.json({ fingerprint });
}
