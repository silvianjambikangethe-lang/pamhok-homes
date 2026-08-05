import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    !body.name.trim() ||
    typeof body.pricePerNight !== "number" ||
    !Number.isFinite(body.pricePerNight) ||
    body.pricePerNight <= 0
  ) {
    return NextResponse.json(
      { error: "Room name and a valid price per night are required." },
      { status: 400 },
    );
  }

  const name = body.name.trim();
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const maxGuests =
    typeof body.maxGuests === "number" && Number.isFinite(body.maxGuests) && body.maxGuests > 0
      ? Math.round(body.maxGuests)
      : 2;
  const bedConfig = typeof body.bedConfig === "string" ? body.bedConfig.trim() : "";
  const amenities = Array.isArray(body.amenities)
    ? body.amenities.filter((a: unknown) => typeof a === "string" && a.trim()).map((a: string) => a.trim())
    : [];
  const doorCode = typeof body.doorCode === "string" ? body.doorCode.trim() : "";
  const wifiPassword = typeof body.wifiPassword === "string" ? body.wifiPassword.trim() : "";
  const photoUrls =
    Array.isArray(body.photoUrls) && body.photoUrls.every((u: unknown) => typeof u === "string")
      ? body.photoUrls
      : [];
  const photoLabels =
    Array.isArray(body.photoLabels) && body.photoLabels.every((l: unknown) => typeof l === "string")
      ? body.photoLabels
      : [];

  const baseSlug = slugify(name) || "room";
  const supabase = await createServerSupabaseClient();

  // Slug has a unique constraint — retry with a numeric suffix on collision,
  // same pattern as booking_reference generation.
  let room: { id: string; slug: string } | null = null;
  for (let attempt = 0; attempt < 6 && !room; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        name,
        slug,
        description,
        price_per_night: body.pricePerNight,
        max_guests: maxGuests,
        bed_config: bedConfig,
        amenities,
        door_code: doorCode,
        wifi_password: wifiPassword,
        photo_urls: photoUrls,
        photo_labels: photoLabels,
        is_active: true,
      })
      .select("id, slug")
      .single();

    if (data) {
      room = data;
    } else if (error?.code !== "23505") {
      return NextResponse.json(
        { error: "Not authorized, or could not create room." },
        { status: 403 },
      );
    }
  }

  if (!room) {
    return NextResponse.json({ error: "Could not create room." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: room.id, slug: room.slug });
}
