-- Supabase performance advisor: three foreign keys had no covering
-- index. bookings.guest_id genuinely has no app query filtering on it
-- yet, but it's still the FK Postgres checks on every guest update/
-- delete, and it's a cheap, purely additive index either way.
-- guest_requests.booking_id and reviews.booking_id are actively
-- queried (portal.ts's latestLaundryRequest lookup, the "already
-- reviewed this stay" check, and the review-count query) - real
-- benefit as data volume grows, even though the current near-empty
-- database shows no measurable difference yet.
create index if not exists idx_bookings_guest_id on bookings (guest_id);
create index if not exists idx_guest_requests_booking_id on guest_requests (booking_id);
create index if not exists idx_reviews_booking_id on reviews (booking_id);
