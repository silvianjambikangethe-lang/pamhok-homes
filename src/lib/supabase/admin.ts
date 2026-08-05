import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Service-role client — bypasses RLS entirely.
// SERVER-ONLY: used for payment webhooks (M-Pesa/PayPal callbacks),
// guest-portal-by-token lookups, and other public-page reads with no
// RLS policy of their own (e.g. the admin contact number), where there is
// no logged-in Supabase session to carry RLS context. Never import this
// file from a Client Component.
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
