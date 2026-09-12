-- ============================================================
-- Guest blocklist — admin-maintained "do not book" list, checked against
-- the booking name at booking time (both the public booking flow and the
-- admin's own manual/walk-in booking flow), so a blocked name can't get a
-- confirmed booking through either path. Deliberately named
-- blocked_guest_names rather than anything using bare "blocked" —
-- bookings.booking_status already has a distinct "Blocked" value used for
-- calendar-date blocking (see block_note / the block-dates admin route),
-- and this table is unrelated to that feature.
--
-- full_name_normalized is computed at write time (lowercased,
-- whitespace-collapsed) rather than normalized on every read — the
-- booking-time check runs on every single booking attempt, so comparing
-- against a precomputed column is cheaper than normalizing every row on
-- every check.
--
-- RLS follows the business_expenses pattern exactly: admin-only, no anon
-- policy at all. Nothing about who is blocked is ever exposed to a
-- public/guest-facing client — the booking route (service-role client)
-- checks it server-side and returns only a generic rejection.
-- ============================================================

create table if not exists blocked_guest_names (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  full_name_normalized text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_blocked_guest_names_normalized
  on blocked_guest_names (full_name_normalized);

alter table blocked_guest_names enable row level security;

create policy "admins manage blocked guest names" on blocked_guest_names
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));
