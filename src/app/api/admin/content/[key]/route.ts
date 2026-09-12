import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SiteContent } from "@/lib/supabase/types";

const VALID_KEYS: SiteContent["key"][] = [
  "homepage",
  "about",
  "amenities",
  "contact",
  "neighborhood",
  "site_status",
  "terms",
];

// This route is generic across 7 unrelated JSON shapes (homepage/about/
// amenities/terms/etc.), each with its own admin form component and its
// own real per-field length that would ideally be enforced — but they're
// admin-authenticated-only writes (no anonymous attacker can reach this
// without already having admin credentials, at which point far bigger
// levers already exist), so a blanket recursive string-length cap is a
// proportionate, schema-agnostic guard rather than hand-modeling all 7
// shapes here. Prevents an oversized paste or a client bug from writing
// an unbounded blob that gets rendered on public marketing pages.
const MAX_STRING_LENGTH = 5000;
const MAX_SERIALIZED_LENGTH = 100_000;

function findOversizedString(value: unknown): boolean {
  if (typeof value === "string") return value.length > MAX_STRING_LENGTH;
  if (Array.isArray(value)) return value.some(findOversizedString);
  if (value && typeof value === "object") {
    return Object.values(value).some(findOversizedString);
  }
  return false;
}

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

  const serialized = JSON.stringify(body.value);
  if (serialized.length > MAX_SERIALIZED_LENGTH || findOversizedString(body.value)) {
    return NextResponse.json({ error: "Content is too long." }, { status: 400 });
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
