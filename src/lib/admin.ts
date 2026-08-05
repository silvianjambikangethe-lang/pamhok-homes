import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Resolves the current admin session for a Server Component / Route
// Handler. This is not just a redirect gate: the query itself only
// succeeds because of the "admins can read their own row" RLS policy on
// admin_users (auth.uid() = id) — a non-admin session gets no row back
// even if they forge the request, so the check is enforced by the
// database, not just this function's control flow.
export async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, email, whatsapp_phone")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) redirect("/admin/login?error=not-authorized");

  return { supabase, admin: adminRow };
}
