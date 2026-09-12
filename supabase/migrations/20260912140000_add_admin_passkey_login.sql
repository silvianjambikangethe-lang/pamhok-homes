-- Passkey (WebAuthn) login for /admin, as a primary alternative to
-- password — not Supabase's built-in MFA system (that requires a
-- password sign-in FIRST, then a webauthn factor as a second step,
-- which is the opposite of what was asked for: biometrics attempted
-- first, password only as a fallback). These two tables back a
-- hand-rolled ceremony instead (see src/lib/webauthn.ts and
-- src/app/api/admin/passkey/*).
--
-- No RLS policies on either table — same shape as login_attempts:
-- both are written/read exclusively via the service-role client from
-- the passkey API routes (a session doesn't exist yet during a login
-- ceremony, so an authenticated-session RLS policy couldn't apply
-- there anyway). RLS is still enabled so the default-deny applies to
-- any other path.

create table if not exists passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  -- Base64url, per the WebAuthn spec's credential ID encoding.
  credential_id text not null unique,
  -- Base64url-encoded COSE public key bytes returned at registration —
  -- used to verify every subsequent authentication assertion.
  public_key text not null,
  -- Signature counter, for basic cloned-authenticator detection: a
  -- counter that doesn't strictly increase between uses indicates the
  -- credential may have been cloned. Most platform authenticators
  -- (Touch ID, Windows Hello) always report 0 and never increment —
  -- verifyAuthenticationResponse handles that case correctly on its own.
  counter bigint not null default 0,
  -- User-supplied or auto-detected label ("Chrome on Windows") shown in
  -- /admin/settings so multiple registered devices are distinguishable.
  device_name text,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Short-lived challenge storage — a WebAuthn ceremony is two requests
-- (options, then verify) and Vercel's serverless functions have no
-- in-process memory to hold the challenge between them. Rows are
-- deleted immediately after a successful verify, and register/login
-- "options" endpoints opportunistically sweep anything older than 5
-- minutes before inserting a new one, so this never grows unbounded
-- without needing a dedicated cron.
create table if not exists passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  type text not null check (type in ('registration', 'authentication')),
  challenge text not null,
  created_at timestamptz not null default now()
);

alter table passkey_credentials enable row level security;
alter table passkey_challenges enable row level security;
