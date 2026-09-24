import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// TEMPORARY testing gate. While site_content.booking_gate is
// {"enabled": true, "allowed_names": [...]}, the public booking route only
// accepts bookings under one of those names; everyone else gets the generic
// "call us to book" response. Turn it off (or remove it) with SQL, no deploy:
//   update site_content set value = '{"enabled": false}' where key = 'booking_gate';
//
// Names are compared case-, space- and apostrophe-insensitively, so
// "Stephen Kang'ethe", "stephen kangethe" and a curly apostrophe all match.
// It is a soft gate on the NAME only: anyone who types an allowed name passes.
function gateKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['‘’ʼ`´]/g, "")
    .replace(/\s+/g, " ");
}

export async function isBookingAllowedByGate(
  supabase: SupabaseClient<Database>,
  fullName: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("site_content")
    .select("value")
    .eq("key", "booking_gate")
    .maybeSingle();

  // Fail closed: if the gate row can't be read, don't let bookings through.
  if (error) return false;
  const gate = data?.value as { enabled?: boolean; allowed_names?: unknown } | null | undefined;
  if (!gate?.enabled) return true;

  const allowed = Array.isArray(gate.allowed_names) ? gate.allowed_names : [];
  const key = gateKey(fullName);
  return allowed.some((n) => typeof n === "string" && gateKey(n) === key);
}
