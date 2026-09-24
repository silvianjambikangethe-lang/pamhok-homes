-- A room is only taken off the availability list once the guest has PAID (or
-- the host blocked it), not the moment an unpaid booking is created.
--
-- Before: any booking with status Confirmed / Pending Verification held its
-- dates immediately, so an unpaid or abandoned booking could lock a room
-- indefinitely. Now a booking holds its dates only when paid_at is set (every
-- payment path sets it: online payment, admin mark-paid, admin walk-in
-- bookings). paid_at, not payment_status = 'Paid', on purpose: a paid guest
-- who requests a stay extension flips payment_status back to Pending while
-- they pay for the extra nights, and their original nights must stay taken.
--
-- Hosts' Blocked dates and the 3-hour extension hold are unchanged.
-- jenga-pgw-initiate re-checks this view right before a guest pays, and
-- jenga-pgw-callback flags the (rare) case of two guests paying for the same
-- dates so one can be refunded.
--
-- To undo: recreate the view with `booking_status = ANY (ARRAY['Confirmed',
-- 'Blocked','Pending Verification'])` in the first SELECT, and re-apply
-- `alter view availability_view set (security_invoker = true)`.

create or replace view availability_view as
select room_id, check_in, check_out, booking_status
from bookings
where booking_status = 'Blocked'
   or (booking_status in ('Confirmed', 'Pending Verification') and paid_at is not null)
union all
select room_id, check_out as check_in, pending_extension_check_out as check_out, booking_status
from bookings
where pending_extension_check_out is not null
  and payment_status = 'Pending'
  and pending_extension_requested_at > (now() - interval '03:00:00')
  and booking_status = 'Confirmed';

alter view availability_view set (security_invoker = true);
