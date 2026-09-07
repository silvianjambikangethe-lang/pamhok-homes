// Creates the ONE shared maintenance-staff login: a Supabase Auth user
// plus its matching staff_users row, in one step. Every worker signs in
// with these same credentials — individual accountability comes from
// the "tap your name" screen after login (see staff_members), not from
// separate per-worker accounts.
//
// Usage:
//   node scripts/bootstrap-staff.mjs staff@pamhokhomes.com 'a-strong-password'
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment (e.g. `node --env-file=.env.local scripts/bootstrap-staff.mjs ...`
// on Node 20.6+, or export them yourself first).
//
// To change the password later, use the "Staff Login" section in
// /admin/settings instead of re-running this script — that also
// immediately signs out any existing staff session everywhere, which
// re-running this script does not do.

import { createClient } from "@supabase/supabase-js";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: node scripts/bootstrap-staff.mjs <email> <password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in the environment.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: userData, error: userError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (userError) {
  console.error("Failed to create the Auth user:", userError.message);
  process.exit(1);
}

const { error: staffError } = await supabase
  .from("staff_users")
  .insert({ id: userData.user.id, email });

if (staffError) {
  console.error(
    "Auth user was created, but inserting the staff_users row failed:",
    staffError.message,
    `\nYou can finish it manually: insert into staff_users (id, email) values ('${userData.user.id}', '${email}');`,
  );
  process.exit(1);
}

console.log(`Staff login created: ${email} (${userData.user.id})`);
console.log("Sign in at /staff/login. Add worker names for the tap screen from /admin/settings.");
