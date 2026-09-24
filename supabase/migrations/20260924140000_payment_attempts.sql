-- Every Jenga checkout attempt for a booking or laundry charge.
--
-- jenga-pgw-initiate used to overwrite bookings.payment_reference on each new
-- attempt, so a guest who started two attempts and paid the FIRST one was
-- charged but never marked Paid (the callback couldn't find the old
-- reference). The callback now looks the reference up here instead, so any
-- attempt that was ever issued can complete.
--
-- Written and read only by the Edge Functions (service role). No policies and
-- no anon/authenticated grants: the references are what stop a forged
-- "paid" callback, so they must never be readable from the browser.

create table if not exists payment_attempts (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  booking_id uuid references bookings(id) on delete cascade,
  request_id uuid references guest_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint payment_attempts_one_target check ((booking_id is null) <> (request_id is null))
);

create index if not exists payment_attempts_booking_id_idx on payment_attempts (booking_id);
create index if not exists payment_attempts_request_id_idx on payment_attempts (request_id);

alter table payment_attempts enable row level security;

revoke all on payment_attempts from public, anon, authenticated;
grant select, insert on payment_attempts to service_role;
