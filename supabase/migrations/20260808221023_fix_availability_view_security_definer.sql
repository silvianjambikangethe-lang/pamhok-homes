-- Supabase security advisor (ERROR): availability_view was SECURITY
-- DEFINER, bypassing bookings' own RLS entirely. It's deliberately
-- public (guests must see date-range availability to book), so the fix
-- isn't to lock it down — it's to make the same public data available
-- through a real, narrow grant instead of a blanket permission bypass.
--
-- anon already had full-table SELECT on bookings at the Postgres grant
-- level (Supabase's default), with only RLS (and, until now, the view's
-- SECURITY DEFINER bypass) standing between anon and every column,
-- including guest_id, payment info, and ID document paths. Nothing in
-- the app actually relies on that broad anon grant — every anon-context
-- read goes through availability_view, and every other access uses the
-- service-role or an authenticated admin session (checked against the
-- app's `from("bookings")` call sites).
--
-- New setup: anon gets column-level SELECT on only the 4 non-sensitive
-- columns the view already exposed, gated by a matching row-level
-- policy, and the view runs security_invoker so it can no longer see or
-- expose anything beyond what anon could already query directly. Same
-- public availability data, no more blanket bypass. `authenticated`
-- (admin sessions) is untouched — admins are the only authenticated
-- users in this app and still need full column access.

revoke select on bookings from anon;
grant select (room_id, check_in, check_out, booking_status) on bookings to anon;

create policy "anon can view availability rows" on bookings
  for select
  to anon
  using (booking_status in ('Confirmed', 'Blocked', 'Pending Verification'));

alter view availability_view set (security_invoker = true);
