-- Short payment-window hold, so two guests can't pay for the same room at the
-- same time.
--
-- Rooms are only taken by PAID bookings (20260924190000). The gap that leaves:
-- guest A clicks Pay and is redirected to Jenga (a session that stays open for
-- 15 minutes, the paymentTimeLimit jenga-pgw-initiate sends) while guest B
-- pays for the same dates. So while a guest has a payment session open for an
-- unpaid booking, those dates are held for 15 minutes, counted from the moment
-- they clicked Pay (payment_attempts.created_at). Nothing is held when a
-- booking is merely created, and the hold vanishes by itself after 15 minutes
-- or the instant the booking is paid (then the main branch takes over).
--
-- booking_id is appended (CREATE OR REPLACE VIEW may only add trailing
-- columns) so jenga-pgw-initiate can ignore the guest's OWN hold when they
-- retry a payment. Change '15 minutes' here if Jenga's paymentTimeLimit is
-- ever changed.
--
-- payment_attempts is service-role only; every reader of availability_view is
-- server code using the service role (src/lib/data.ts, /api/bookings, the
-- extend routes, the payment functions).

create or replace view availability_view as
select b.room_id, b.check_in, b.check_out, b.booking_status, b.id as booking_id
from bookings b
where b.booking_status = 'Blocked'
   or (b.booking_status in ('Confirmed', 'Pending Verification') and b.paid_at is not null)
union all
select b.room_id, b.check_out as check_in, b.pending_extension_check_out as check_out, b.booking_status, b.id as booking_id
from bookings b
where b.pending_extension_check_out is not null
  and b.payment_status = 'Pending'
  and b.pending_extension_requested_at > (now() - interval '03:00:00')
  and b.booking_status = 'Confirmed'
union all
select b.room_id, b.check_in, b.check_out, b.booking_status, b.id as booking_id
from bookings b
where b.paid_at is null
  and b.booking_status in ('Confirmed', 'Pending Verification')
  and exists (
    select 1 from payment_attempts p
    where p.booking_id = b.id
      and p.created_at > (now() - interval '15 minutes')
  );

alter view availability_view set (security_invoker = true);
