import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Shared with the admin blocklist CRUD route so a name is normalized the
// same way whether it's being stored or being checked against.
export function normalizeGuestName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Exact match on the normalized name — deliberately not fuzzy like the ID
// OCR comparison in src/lib/dojah.ts. This gates whether a booking is
// created at all, so a false positive here fully blocks a legitimate
// guest with no retry path, unlike the ID check's retry-then-manual-review
// flow. An admin adds the exact name they want blocked; a near-miss
// should not silently sweep in an unrelated guest.
export async function isNameBlocked(
  supabase: SupabaseClient<Database>,
  fullName: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("blocked_guest_names")
    .select("id")
    .eq("full_name_normalized", normalizeGuestName(fullName))
    .maybeSingle();

  return !!data;
}
