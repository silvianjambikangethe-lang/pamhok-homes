-- Confirming check-out (the guest's own button, or the admin's "Mark
-- checked out") only ever set checked_out_at — it never touched
-- check_out, so a guest leaving ahead of their booked check_out date
-- still blocked the room in availability_view clear through to that
-- original date. This has availability_view treat an early checkout as
-- shortening the effective check_out to the checkout date itself (same
-- "turnover day" convention check_out already uses: the room opens up
-- the same calendar day), so a new booking can take the room right
-- away instead of waiting out the original stay length. A checkout on
-- or after the original check_out date changes nothing — the room was
-- already free from that date on.
create or replace view availability_view as
  select
    b.room_id,
    b.check_in,
    case
      when b.checked_out_at is not null
        and (b.checked_out_at + interval '3 hours')::date < b.check_out
      then (b.checked_out_at + interval '3 hours')::date
      else b.check_out
    end as check_out,
    b.booking_status,
    b.id as booking_id
  from bookings b
  where b.booking_status = 'Blocked'
     or (b.booking_status = any (array['Confirmed','Pending Verification']) and b.paid_at is not null)
  union all
  select
    b.room_id,
    b.check_out as check_in,
    b.pending_extension_check_out as check_out,
    b.booking_status,
    b.id as booking_id
  from bookings b
  where b.pending_extension_check_out is not null
    and b.payment_status = 'Pending'
    and b.pending_extension_requested_at > (now() - interval '00:10:00')
    and b.booking_status = 'Confirmed'
  union all
  select
    b.room_id,
    b.check_in,
    case
      when b.checked_out_at is not null
        and (b.checked_out_at + interval '3 hours')::date < b.check_out
      then (b.checked_out_at + interval '3 hours')::date
      else b.check_out
    end as check_out,
    b.booking_status,
    b.id as booking_id
  from bookings b
  where b.paid_at is null
    and b.booking_status = any (array['Confirmed','Pending Verification'])
    and exists (
      select 1 from payment_attempts p
      where p.booking_id = b.id and p.created_at > (now() - interval '00:15:00')
    );

alter view availability_view set (security_invoker = true);
grant select on availability_view to anon, authenticated;
