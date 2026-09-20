-- Follow-up to 20260920200000. Anonymous visitors had table-wide SELECT on
-- public.reviews, so revoking the single booking_id column did nothing. Remove
-- the table-wide permission and grant back only the columns a public review
-- shows: the guest's display name, the rating and what they wrote. The link
-- back to the booking (booking_id) is no longer readable by the public.
--
-- To undo: grant select on public.reviews to anon;

revoke select on public.reviews from anon;
grant select (id, rating, comment, guest_display_name, featured, created_at)
  on public.reviews to anon;
