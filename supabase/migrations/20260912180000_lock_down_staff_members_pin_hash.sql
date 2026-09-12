-- pin_hash must never be SELECTable by anon/authenticated — only
-- service-role (used server-side in /api/staff/select-worker) needs to
-- read it. The "staff can view active staff members" RLS policy
-- correctly scopes which ROWS a staff session can see, but RLS doesn't
-- scope columns — combined with Postgres's default table-wide grants to
-- authenticated/anon, any signed-in staff session could read every
-- active worker's pin_hash straight off the public REST API and crack it
-- offline (a 4-6 digit PIN is a tiny keyspace), completely bypassing the
-- rate-limited /api/staff/select-worker route this was meant to gate.
--
-- A column-specific revoke can't override an existing table-wide grant,
-- so this revokes everything on the table first and re-grants only what
-- each role legitimately needs (same pattern as
-- 20260907000100_lock_down_staff_view_default_grants.sql).
revoke all on staff_members from authenticated;
revoke all on staff_members from anon;

grant select (id, name, active, created_at) on staff_members to authenticated;
grant insert (name, pin_hash) on staff_members to authenticated;
grant update (name, active, pin_hash) on staff_members to authenticated;
