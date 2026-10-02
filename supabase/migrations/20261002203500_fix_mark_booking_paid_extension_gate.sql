-- mark_booking_paid's pending-extension resolution was gated on
-- "not already paid before", which is never true for a stay-extension
-- top-up (the guest is, by definition, already paid for their original
-- stay before they can request more nights — see extend/confirm's own
-- "fully paid before you can request more nights" check). That made the
-- Jenga guest-payment path (the only caller of this RPC) silently skip
-- applying the extension on every single extension payment: payment_status
-- flipped to Paid, but check_out never advanced and pending_extension_*
-- never cleared. It also meant every legitimate extension payment was
-- logged as a false-positive "DUPLICATE PAYMENT" security event, since
-- `already_paid` conflated "paid before" with "nothing left to do here".
--
-- Fix: gate extension resolution on pending_extension_check_out being set
-- (matching resolvePendingExtensionAfterPayment in src/lib/extension-hold.ts,
-- the admin manual mark-paid path's equivalent, which never had this bug),
-- and redefine "already_paid" for the duplicate-payment check as "paid
-- before AND nothing currently pending" — a genuine no-op payment, not an
-- extension top-up. Also sets extension_confirmed_at (added in
-- 20261002202943_add_extension_confirmed_at.sql) so the guest's next
-- portal load shows a distinct "your extension payment has been received"
-- message instead of the ordinary first-check-in confirmation card.
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

  -- Paid before AND nothing currently awaiting payment: this callback has
  -- nothing left to do and really is a duplicate (the guest was charged
  -- twice for the same thing). Paid before but WITH a pending extension is
  -- the ordinary "topping up for extra nights" case, not a duplicate.
  v_was_already_settled := v_booking.paid_at is not null and v_booking.pending_extension_check_out is null;

  update bookings
  set payment_status = 'Paid',
      payment_method = p_method,
      payment_reference = coalesce(p_reference, payment_reference),
      paid_at = coalesce(v_booking.paid_at, now())
  where id = p_booking_id;

  if v_booking.pending_extension_check_out is not null then
    v_expired := (now() - v_booking.pending_extension_requested_at) > interval '3 hours';

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
            'Guest paid, but their extension hold had already expired (3hr window passed) before payment cleared — extra nights were NOT granted, amount adjusted back down. Check whether a refund of the difference is owed.'
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
