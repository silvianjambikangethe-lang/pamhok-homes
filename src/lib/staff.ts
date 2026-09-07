import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Mirrors requireAdmin() in @/lib/admin.ts exactly, checking staff_users
// instead of admin_users. Same DB-enforced guarantee: the query only
// succeeds because of the "staff can read their own row" RLS policy
// (auth.uid() = id) — an admin (or any other) session gets no row back,
// so a staff-only route can't be reached by forging a request either.
//
// For Server Components/pages only — uses next/navigation's redirect(),
// which is the right behavior for a page but wrong for a fetch()-called
// API route (a client fetch would follow the redirect to the login
// page's HTML instead of getting a clean JSON error, and res.ok would
// reflect that final 200, silently masking the failure). API routes use
// getStaffApiSession() below instead.
export async function requireStaff() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/staff/login");

  const { data: staffRow } = await supabase
    .from("staff_users")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!staffRow) redirect("/staff/login?error=not-authorized");

  return { supabase, staff: staffRow };
}

// Same check as requireStaff(), but returns null instead of redirecting
// — for API Route Handlers, which should respond with a JSON 401/403,
// not an HTML redirect. Mirrors /api/admin/settings/password's own
// explicit "confirm membership before touching the service-role client"
// pattern, generalized for reuse across every staff route that needs it.
export async function getStaffApiSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: staffRow } = await supabase
    .from("staff_users")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!staffRow) return null;

  return { supabase, staff: staffRow };
}

// The tap-name cookie is attribution/UX only, never an authorization
// boundary — requireStaff() + the Supabase session above is the real
// gate. Re-validated against staff_members.active on every dashboard
// load (see staff/(dashboard)/layout.tsx), so deactivating a worker
// mid-shift takes effect immediately, not just at next login.
const WORKER_COOKIE = "staff_worker_id";

export async function getActiveWorkerId(): Promise<string | null> {
  const store = await cookies();
  return store.get(WORKER_COOKIE)?.value ?? null;
}

export { WORKER_COOKIE };
