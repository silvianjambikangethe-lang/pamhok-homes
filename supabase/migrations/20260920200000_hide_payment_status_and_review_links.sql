-- Privacy: what the public can read directly from the database.
--
-- 1. Booked dates are now read on the server (src/lib/data.ts), so anonymous
--    visitors no longer need any direct access to bookings or the
--    availability view. That also removes the public's view of payment status
--    (Paid / Pending), which is meant only for the guest who is paying.
-- 2. Public reviews show the guest's display name and what they wrote, with no
--    link back to the booking.
--
-- Deploy the code that reads availability on the server BEFORE applying this,
-- otherwise the public pages lose their availability data.
--
-- To undo:
--   grant select (booking_status, check_in, check_out, payment_status,
--     pending_extension_check_out, pending_extension_requested_at, room_id)
--     on public.bookings to anon;
--   create policy "anon can view availability rows" on public.bookings
--     for select to anon
--     using (booking_status = any (array['Confirmed','Blocked','Pending Verification']));
--   grant select on public.availability_view to anon;
--   grant select (booking_id) on public.reviews to anon;

drop policy if exists "anon can view availability rows" on public.bookings;
revoke select on public.bookings from anon;
revoke select on public.availability_view from anon;

revoke select (booking_id) on public.reviews from anon;
