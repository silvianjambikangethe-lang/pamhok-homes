import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveMapsLink } from "@/lib/maps";

// This route makes an outbound fetch on the server's behalf rather than a
// DB write, so there's no RLS policy to lean on for auth — check the admin
// session explicitly, same pattern as /api/admin/settings/phone.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Missing link." }, { status: 400 });
  }

  const coords = await resolveMapsLink(url);
  if (!coords) {
    return NextResponse.json(
      {
        error:
          "Couldn't find a location in this link. Copy it fresh from Google Maps' Share button and try again.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json(coords);
}
