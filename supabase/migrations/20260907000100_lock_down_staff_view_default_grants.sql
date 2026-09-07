-- Supabase's default privileges (ALTER DEFAULT PRIVILEGES) grant every
-- new public-schema relation full INSERT/UPDATE/DELETE/TRUNCATE/
-- REFERENCES/TRIGGER to `authenticated` automatically, on top of any
-- explicit grants — Postgres privileges are additive, so the narrow
-- `grant select (...)`/`grant update (...)` statements in the previous
-- migration did NOT actually restrict anything: a staff session could
-- have DELETEd rows through any of the four staff_* views (deleting the
-- underlying guest_requests/shift_logs row, since these views are
-- security_invoker = false), or INSERTed junk rows. This mirrors exactly
-- why bookings -> anon needed an explicit revoke before its narrow
-- grant (see availability_view in schema.sql) — that step was missed
-- when the staff views were first created, caught by verifying grants
-- directly against the live project right after applying that
-- migration, before this was ever exposed to a real staff session.

revoke all on staff_cleaning_laundry_feed from authenticated;
grant select on staff_cleaning_laundry_feed to authenticated;

revoke all on staff_checkout_schedule from authenticated;
grant select on staff_checkout_schedule to authenticated;

revoke all on staff_task_updates from authenticated;
grant select (id, request_type, status, completed_by) on staff_task_updates to authenticated;
grant update (status, completed_by) on staff_task_updates to authenticated;

revoke all on staff_clock_updates from authenticated;
grant select (id, staff_member_id, clock_in_at, clock_out_at) on staff_clock_updates to authenticated;
grant update (clock_out_at) on staff_clock_updates to authenticated;
