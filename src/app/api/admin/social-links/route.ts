import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SOCIAL_PLATFORMS } from "@/lib/social-icons";

const VALID_PLATFORMS = SOCIAL_PLATFORMS.map((p) => p.value);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const platform = body?.platform;
  const url = body?.url;

  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Unknown platform." }, { status: 400 });
  }
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: existing } = await supabase
    .from("social_links")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("social_links")
    .insert({ platform, url: url.trim(), display_order: nextOrder })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Not authorized, or could not add link." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
