-- ============================================================
-- Per-worker PIN, checked when a staff_members tile is tapped at /staff.
-- Previously tapping a name required no secret at all — anyone signed
-- into the one shared staff login could become any active worker. This
-- adds a genuine per-person credential underneath that shared login, so
-- deactivating/deleting a worker (or resetting their PIN) actually
-- revokes something, with no effect on any other worker.
--
-- Nullable: existing rows (added before this feature) have no PIN yet.
-- Their tile still shows, but the tap-in check (see
-- src/app/api/staff/select-worker/route.ts) rejects a null pin_hash with
-- a clear "ask the host to set one" error rather than granting access or
-- letting anyone self-assign a PIN to an unclaimed identity — the admin
-- sets it from /admin/settings, same "admin sets, no self-service"
-- pattern as the shared staff login itself.
-- ============================================================

alter table staff_members add column if not exists pin_hash text;
