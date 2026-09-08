-- ============================================================
-- Reconciliation migration — not a new change, a catch-up.
--
-- Between 2026-08-27 and 2026-09-02, nine changes were applied directly
-- to the live database via the Supabase MCP tool and never committed as
-- migration files here, so this repo's migration history silently fell
-- behind the real one. In remote order (see `list_migrations`), by name
-- only — their exact original SQL bodies were never captured locally,
-- and several of them are a self-correcting back-and-forth on the same
-- view (fix → revert → re-fix) that only makes sense to read as a
-- sequence, not replayed individually:
--
--   add_pending_extension_columns
--   add_extension_hold_tracking_and_view
--   fix_availability_view_security_invoker
--   revert_availability_view_security_invoker
--   grant_anon_narrow_bookings_select
--   reenable_availability_view_security_invoker
--   expand_anon_bookings_grant_for_view_where_clause
--   drop_unused_rls_test_table
--   drop_redundant_looser_anon_bookings_policy
--
-- Rather than fabricate nine individual scripts from memory, this one
-- file brings a fresh database to the same *end state* all nine reached
-- together: the "Rebuild stay extensions" feature (commit 7a484e7) and
-- its follow-up security fix (commit 4b8662b). Every statement below is
-- idempotent (if-not-exists / or-replace / drop-if-exists), so it's
-- also safe to run against the already-live project without effect.
--
-- supabase/schema.sql (the "fresh project" script) already reflects
-- this same end state directly — this file exists so `supabase/
-- migrations/` has a record of *when* it changed, for anyone diffing
-- history. If the two ever disagree, trust schema.sql (and, above
-- that, the live project itself).
-- ============================================================

alter table bookings
  add column if not exists pending_extension_check_out date,
  add column if not exists pending_extension_nights int,
  add column if not exists pending_extension_amount numeric(10,2),
  add column if not exists pending_extension_requested_at timestamptz;

comment on column bookings.pending_extension_check_out is
  'A guest-requested stay extension is not applied to check_out until its payment is confirmed. This holds the check_out date that will be applied once payment_status becomes Paid.';
comment on column bookings.pending_extension_nights is
  'Extra nights requested alongside pending_extension_check_out, for display only.';
comment on column bookings.pending_extension_amount is
  'The additional cost already folded into total_amount for the pending extension — kept separately so it can be cleanly subtracted back out if the hold expires or conflicts.';
comment on column bookings.pending_extension_requested_at is
  'When the guest requested the pending extension. The hold on those extra nights (see availability_view) and the guest''s window to pay for them both expire 3 hours after this.';

revoke select on bookings from anon;
grant select (
  room_id, check_in, check_out, booking_status,
  payment_status, pending_extension_check_out, pending_extension_requested_at
) on bookings to anon;

-- The "grant_anon_narrow_bookings_select" / "drop_redundant_looser_anon_
-- bookings_policy" pair (mentioned above) replaced an earlier, looser
-- anon SELECT policy with this single narrower one — if an old one by a
-- different name still exists, drop it so this is the only one.
drop policy if exists "anon can view availability rows" on bookings;
create policy "anon can view availability rows" on bookings
  for select
  to anon
  using (booking_status in ('Confirmed', 'Blocked', 'Pending Verification'));

create or replace view availability_view as
  select room_id, check_in, check_out, booking_status
  from bookings
  where booking_status in ('Confirmed', 'Blocked', 'Pending Verification')
  union all
  select room_id, check_out as check_in, pending_extension_check_out as check_out, booking_status
  from bookings
  where pending_extension_check_out is not null
    and payment_status = 'Pending'
    and pending_extension_requested_at > (now() - interval '3 hours')
    and booking_status = 'Confirmed';

-- The "fix → revert → reenable" back-and-forth in the name list above
-- landed back on security_invoker = true (see the file header) —
-- confirmed against the live project's pg_class.reloptions.
alter view availability_view set (security_invoker = true);

grant select on availability_view to anon, authenticated;

-- "drop_unused_rls_test_table": whatever ad-hoc table that migration
-- removed live is, by definition, already gone and was never part of
-- this repo's schema — nothing to replay here.
