-- Phase 2/3 of the blast-radius reduction plan: today, every guest-facing
-- payment callback (mpesa-callback, mpesa-callback-laundry,
-- jenga-card-callback) holds the full service-role key and writes to
-- bookings/guest_requests directly with hand-built update chains. A bug in
-- any one of those callbacks' own validation logic could, in principle,
-- touch anything in the database, because the service-role key itself
-- draws no line — the app code is the only boundary.
--
-- These functions ARE that boundary instead: each one does exactly one
-- narrow, reviewed thing (mark a specific booking/request paid or failed,
-- resolve a pending extension hold), and nothing else is expressible
-- through them no matter what the calling code does wrong. The calling
-- Edge Functions are updated to call these via .rpc(...) instead of
-- chaining raw table writes — see mpesa-callback, mpesa-callback-laundry,
-- and jenga-card-callback.
--
-- Each function also logs its own invocation to security_events, so an
-- unusual pattern (e.g. the same booking id being marked paid repeatedly,
-- or amounts that don't add up) is visible after the fact rather than
-- silent — the "make guest-side privileged writes visible" half of the
-- plan.

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  booking_id uuid references bookings(id) on delete set null,
  request_id uuid references guest_requests(id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_events_created_at on security_events (created_at desc);

alter table security_events enable row level security;

create policy "admins view security events" on security_events
  for select
  to authenticated
  using ((select auth.uid()) in (select id from admin_users));

revoke all on security_events from anon;
revoke all on security_events from authenticated;
grant select on security_events to authenticated;

-- Marks a booking's stay payment as succeeded and resolves any pending
-- extension hold exactly the way mpesa-callback/index.ts's inline logic
-- did — moved here so it's a fixed, single-purpose unit of work instead of
-- freeform table access. Returns what the caller needs to decide which
-- confirmation email (if any) to send; it does not send email itself,
-- since Resend calls have no business being inside a SECURITY DEFINER SQL
-- function.
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
  v_was_already_paid boolean;
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

  v_was_already_paid := v_booking.paid_at is not null;

  update bookings
  set payment_status = 'Paid',
      payment_method = p_method,
      payment_reference = coalesce(p_reference, payment_reference),
      paid_at = coalesce(v_booking.paid_at, now())
  where id = p_booking_id;

  if not v_was_already_paid and v_booking.pending_extension_check_out is not null then
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
          pending_extension_requested_at = null
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
      'already_paid', v_was_already_paid,
      'extension_reverted', v_extension_reverted,
      'extension_applied', v_extension_applied
    )
  );

  return jsonb_build_object(
    'already_paid', v_was_already_paid,
    'extension_reverted', v_extension_reverted,
    'extension_applied', v_extension_applied
  );
end;
$$;

revoke all on function mark_booking_paid(uuid, text, text) from public;
grant execute on function mark_booking_paid(uuid, text, text) to service_role;

create or replace function mark_booking_payment_failed(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update bookings set payment_status = 'Failed' where id = p_booking_id;

  insert into security_events (event_type, booking_id)
  values ('mark_booking_payment_failed', p_booking_id);
end;
$$;

revoke all on function mark_booking_payment_failed(uuid) from public;
grant execute on function mark_booking_payment_failed(uuid) to service_role;

create or replace function mark_laundry_paid(
  p_request_id uuid,
  p_method text,
  p_reference text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_method not in ('mpesa', 'card', 'manual') then
    raise exception 'invalid payment method: %', p_method;
  end if;

  update guest_requests
  set laundry_payment_status = 'Paid',
      laundry_payment_method = p_method,
      laundry_payment_reference = coalesce(p_reference, laundry_payment_reference),
      laundry_paid_at = now(),
      updated_at = now()
  where id = p_request_id and request_type = 'laundry';

  insert into security_events (event_type, request_id, detail)
  values ('mark_laundry_paid', p_request_id, jsonb_build_object('method', p_method, 'reference', p_reference));
end;
$$;

revoke all on function mark_laundry_paid(uuid, text, text) from public;
grant execute on function mark_laundry_paid(uuid, text, text) to service_role;

create or replace function mark_laundry_payment_failed(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update guest_requests
  set laundry_payment_status = 'Failed', updated_at = now()
  where id = p_request_id and request_type = 'laundry';

  insert into security_events (event_type, request_id)
  values ('mark_laundry_payment_failed', p_request_id);
end;
$$;

revoke all on function mark_laundry_payment_failed(uuid) from public;
grant execute on function mark_laundry_payment_failed(uuid) to service_role;
