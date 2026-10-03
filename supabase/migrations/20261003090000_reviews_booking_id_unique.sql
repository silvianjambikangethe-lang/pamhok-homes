-- POST /api/portal/[token]/review checks for an existing review then
-- inserts, with no transaction between the two — two near-simultaneous
-- submits (double-click, two open tabs on the same portal link) could
-- both pass the "no existing review" check before either insert lands,
-- producing two reviews for one stay. A unique index closes the race at
-- the database level instead of relying on the app-level check alone.
-- NULLs (no booking_id) are unaffected — Postgres allows multiple NULLs
-- in a unique index.
create unique index if not exists reviews_booking_id_unique on reviews (booking_id);
