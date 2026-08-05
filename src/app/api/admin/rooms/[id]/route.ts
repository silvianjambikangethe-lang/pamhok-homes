import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Room } from "@/lib/supabase/types";

// This file is the per-room [id] route (PATCH), but room *creation* has no
// id yet — POST here is handled by the sibling src/app/api/admin/rooms/route.ts.

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing update fields." }, { status: 400 });
  }

  const update: Partial<Room> = {};

  if (typeof body.doorCode === "string") update.door_code = body.doorCode.trim();
  if (typeof body.wifiPassword === "string") update.wifi_password = body.wifiPassword.trim();
  if (typeof body.name === "string") update.name = body.name.trim();
  if (typeof body.description === "string") update.description = body.description.trim();
  if (typeof body.pricePerNight === "number" && Number.isFinite(body.pricePerNight)) {
    update.price_per_night = body.pricePerNight;
  }
  if (Array.isArray(body.photoUrls) && body.photoUrls.every((u: unknown) => typeof u === "string")) {
    update.photo_urls = body.photoUrls;
  }
  if (
    Array.isArray(body.photoLabels) &&
    body.photoLabels.every((l: unknown) => typeof l === "string")
  ) {
    update.photo_labels = body.photoLabels;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("rooms")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not update room." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or room not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
