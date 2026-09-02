// Creates the first (or an additional) admin login: a Supabase Auth user
// plus its matching admin_users row, in one step. Replaces the fully
// manual "create a user in the dashboard, then hand-write an INSERT in
// the SQL Editor" process documented in schema.sql's trailing comment.
//
// Usage:
//   node scripts/bootstrap-admin.mjs you@example.com 'a-strong-password'
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
// environment (e.g. `node --env-file=.env.local scripts/bootstrap-admin.mjs ...`
// on Node 20.6+, or export them yourself first).

import { createClient } from "@supabase/supabase-js";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: node scripts/bootstrap-admin.mjs <email> <password>");
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

const { error: adminError } = await supabase
  .from("admin_users")
  .insert({ id: userData.user.id, email });

if (adminError) {
  console.error(
    "Auth user was created, but inserting the admin_users row failed:",
    adminError.message,
    `\nYou can finish it manually: insert into admin_users (id, email) values ('${userData.user.id}', '${email}');`,
  );
  process.exit(1);
}

console.log(`Admin created: ${email} (${userData.user.id})`);
console.log("Sign in at /admin/login. You'll be asked to set a WhatsApp contact number on first login.");
