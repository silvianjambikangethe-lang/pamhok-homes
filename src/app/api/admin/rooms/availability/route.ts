import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Backs the Manual Booking form's Room dropdown: once the admin picks
// check-in/check-out, this returns only the rooms actually free for that
// range (same overlap rule as availability_view, which the public booking
// route also leans on), so the dropdown can't offer a room that's really
// taken.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";

  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  // Same explicit admin-session check as the other admin route handlers
  // (e.g. /api/admin/resolve-maps-link) — no RLS policy to lean on here.
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const { data: adminRow } = await authClient
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const [{ data: rooms, error: roomsError }, { data: taken, error: takenError }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("is_active", true).order("display_order"),
    supabase
      .from("availability_view")
      .select("room_id")
      .lt("check_in", checkOut)
      .gt("check_out", checkIn),
  ]);

  if (roomsError || takenError || !rooms) {
    return NextResponse.json({ error: "Could not load room availability." }, { status: 500 });
  }

  const takenRoomIds = new Set((taken ?? []).map((t) => t.room_id));
  const availableRooms = rooms.filter((r) => !takenRoomIds.has(r.id));

  return NextResponse.json({ rooms: availableRooms });
}
