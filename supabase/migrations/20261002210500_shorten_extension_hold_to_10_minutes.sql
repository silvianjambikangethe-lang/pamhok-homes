-- The stay-extension hold (how long the extra nights stay blocked from
-- other guests while this guest arranges payment) moves from 3 hours to
-- 10 minutes. availability_view computes this live from
-- pending_extension_requested_at, so the room becomes bookable by other
-- guests again automatically the moment the window passes unpaid — no
-- cron or page load needed for that part. Rebuilt from the view's actual
-- live definition (pg_get_viewdef), which has diverged from the
-- schema.sql snapshot (gained a booking_id column and a third branch for
-- the unpaid first-payment window hold) — only the extension hold's
-- interval changes here, nothing else.
create or replace view availability_view as
  select b.room_id,
    b.check_in,
    b.check_out,
    b.booking_status,
    b.id as booking_id
  from bookings b
  where b.booking_status = 'Blocked'::text
    or (b.booking_status = any (array['Confirmed'::text, 'Pending Verification'::text]) and b.paid_at is not null)
  union all
  select b.room_id,
    b.check_out as check_in,
    b.pending_extension_check_out as check_out,
    b.booking_status,
    b.id as booking_id
  from bookings b
  where b.pending_extension_check_out is not null
    and b.payment_status = 'Pending'::text
    and b.pending_extension_requested_at > (now() - interval '10 minutes')
    and b.booking_status = 'Confirmed'::text
  union all
  select b.room_id,
    b.check_in,
    b.check_out,
    b.booking_status,
    b.id as booking_id
  from bookings b
  where b.paid_at is null
    and (b.booking_status = any (array['Confirmed'::text, 'Pending Verification'::text]))
    and exists (
      select 1 from payment_attempts p
      where p.booking_id = b.id and p.created_at > (now() - interval '00:15:00')
    );

alter view availability_view set (security_invoker = true);

grant select on availability_view to anon, authenticated;

-- mark_booking_paid's own expiry check, matched to the same 10-minute
-- window so it never accepts a payment the view would already treat as
-- expired.
create or replace function mark_booking_paid(
  p_booking_id uuid,
  p_method text,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_was_already_settled boolean;
  v_expired boolean;
  v_conflict boolean;
  v_extension_reverted boolean := false;
  v_extension_applied boolean := false;
begin
  if p_method not in ('mpesa', 'card', 'manual') then
    raise exception 'invalid payment method: %', p_method;
  end if;

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('error', 'booking_not_found');
  end if;

  v_was_already_settled := v_booking.paid_at is not null and v_booking.pending_extension_check_out is null;

  update bookings
  set payment_status = 'Paid',
      payment_method = p_method,
      payment_reference = coalesce(p_reference, payment_reference),
      paid_at = coalesce(v_booking.paid_at, now())
  where id = p_booking_id;

  if v_booking.pending_extension_check_out is not null then
    v_expired := (now() - v_booking.pending_extension_requested_at) > interval '10 minutes';

    v_conflict := false;
    if not v_expired and v_booking.room_id is not null then
      select exists (
        select 1 from bookings
        where room_id = v_booking.room_id
          and id <> v_booking.id
          and booking_status in ('Confirmed', 'Blocked', 'Pending Verification')
          and check_in < v_booking.pending_extension_check_out
          and check_out > v_booking.check_out
      ) into v_conflict;
    end if;

    update guest_requests
    set status = 'Closed'
    where booking_id = v_booking.id
      and request_type = 'extension'
      and status = 'Open';

    if v_expired or v_conflict then
      v_extension_reverted := true;
      update bookings
      set total_amount = total_amount - coalesce(v_booking.pending_extension_amount, 0),
          pending_extension_check_out = null,
          pending_extension_nights = null,
          pending_extension_amount = null,
          pending_extension_requested_at = null
      where id = v_booking.id;

      insert into guest_requests (booking_id, request_type, message, status)
      values (
        v_booking.id,
        'extension',
        case
          when v_expired then
            'Guest paid, but their extension hold had already expired (10min window passed) before payment cleared — extra nights were NOT granted, amount adjusted back down. Check whether a refund of the difference is owed.'
          else
            'Guest paid, but the extra nights were booked by someone else in the meantime — extra nights were NOT granted, amount adjusted back down. Check whether a refund of the difference is owed.'
        end,
        'Open'
      );
    else
      v_extension_applied := true;
      update bookings
      set check_out = v_booking.pending_extension_check_out,
          pending_extension_check_out = null,
          pending_extension_nights = null,
          pending_extension_amount = null,
          pending_extension_requested_at = null,
          extension_confirmed_at = now()
      where id = v_booking.id;

      insert into guest_requests (booking_id, request_type, message, status)
      values (
        v_booking.id,
        'extension',
        'Extension confirmed — payment received for ' || v_booking.pending_extension_nights
          || ' extra night' || (case when v_booking.pending_extension_nights = 1 then '' else 's' end)
          || '. Stay now extends to ' || v_booking.pending_extension_check_out || '.',
        'Open'
      );
    end if;
  end if;

  insert into security_events (event_type, booking_id, detail)
  values (
    'mark_booking_paid',
    p_booking_id,
    jsonb_build_object(
      'method', p_method,
      'reference', p_reference,
      'already_paid', v_was_already_settled,
      'extension_reverted', v_extension_reverted,
      'extension_applied', v_extension_applied
    )
  );

  return jsonb_build_object(
    'already_paid', v_was_already_settled,
    'extension_reverted', v_extension_reverted,
    'extension_applied', v_extension_applied
  );
end;
$$;

revoke execute on function mark_booking_paid(uuid, text, text) from public, anon, authenticated;
grant execute on function mark_booking_paid(uuid, text, text) to service_role;
