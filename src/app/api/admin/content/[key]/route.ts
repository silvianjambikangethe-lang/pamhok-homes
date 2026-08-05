import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SiteContent } from "@/lib/supabase/types";

const VALID_KEYS: SiteContent["key"][] = ["homepage", "about", "amenities", "contact"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key: rawKey } = await params;

  if (!VALID_KEYS.includes(rawKey as SiteContent["key"])) {
    return NextResponse.json({ error: "Unknown content section." }, { status: 400 });
  }
  const key = rawKey as SiteContent["key"];

  const body = await request.json().catch(() => null);
  if (!body || typeof body.value === "undefined") {
    return NextResponse.json({ error: "Missing value." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("site_content")
    .upsert({ key, value: body.value, updated_at: new Date().toISOString() })
    .select("key");

  if (error) {
    return NextResponse.json({ error: "Could not save changes." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
