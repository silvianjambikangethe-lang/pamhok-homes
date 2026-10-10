-- A one-time, per-booking override of the site-wide check-in time (see
-- CHECK_IN_TIME in src/lib/site.ts) — for when cleaning/turnover runs long
-- and the admin needs to push one specific guest's check-in later (e.g.
-- "2:00 PM" instead of the usual "1:00 PM"). Stored as display-ready text,
-- same format as CHECK_IN_TIME itself, so nothing needs to parse it beyond
-- reading the hour back out for the "your room is being prepared" cutoff.
-- Null means "use the normal CHECK_IN_TIME" — since this lives on the
-- booking row itself, the next booking for that room is a fresh row with
-- no override, so it resets on its own without any extra logic.
alter table public.bookings
  add column if not exists check_in_time_override text;
