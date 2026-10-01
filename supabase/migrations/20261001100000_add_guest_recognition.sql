-- "Remember Me" returning-guest recognition. A guest who opts in at
-- checkout (see completeCheckout) gets a row here keyed by email; later,
-- from /rooms, they prove they still own that email via a one-time code
-- (guest_recognition_codes) before the booking flow skips ID verification.
-- Email + name alone are guessable/public-ish and are never trusted as
-- identity on their own — see src/lib/guest-recognition.ts.
--
-- Both tables are written and read only by API routes via the service-role
-- client. No policies and no anon/authenticated grants: letting the browser
-- read guest_recognition_codes would turn the OTP into a bypassable check,
-- and remembered_guests is exactly the data this feature must keep private.

create table if not exists remembered_guests (
  email text primary key,
  full_name text not null,
  last_booking_id uuid references bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guest_recognition_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists guest_recognition_codes_email_idx on guest_recognition_codes (email);

alter table remembered_guests enable row level security;
alter table guest_recognition_codes enable row level security;

revoke all on remembered_guests from public, anon, authenticated;
revoke all on guest_recognition_codes from public, anon, authenticated;
grant select, insert, update, delete on remembered_guests to service_role;
grant select, insert, update, delete on guest_recognition_codes to service_role;
