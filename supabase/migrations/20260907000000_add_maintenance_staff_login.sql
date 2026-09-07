-- ============================================================
-- Maintenance staff — a second, restricted login for cleaners/laundry
-- staff, separate from admin_users on purpose: admin_users membership
-- grants blanket access via several "admins manage X" policies, so a
-- role column there would make staff inherit full access to
-- bookings/guests/payments. staff_users instead gets its own table with
-- none of those policies, and staff reach data only through the
-- purpose-built views below.
-- ============================================================

create table if not exists staff_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists shift_logs (
  id uuid primary key default gen_random_uuid(),
  staff_member_id uuid not null references staff_members(id) on delete restrict,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now()
);

alter table guest_requests
  add column if not exists completed_by uuid references staff_members(id) on delete set null,
  add column if not exists is_turnover boolean not null default false;

create index if not exists idx_shift_logs_staff_member_id on shift_logs (staff_member_id);

create unique index if not exists shift_logs_one_open_per_worker
  on shift_logs (staff_member_id)
  where clock_out_at is null;

create unique index if not exists guest_requests_turnover_unique
  on guest_requests (booking_id)
  where is_turnover = true and request_type = 'cleaning';

alter table staff_users enable row level security;
alter table staff_members enable row level security;
alter table shift_logs enable row level security;

create policy "staff can read their own row" on staff_users
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "admins manage staff members" on staff_members
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

create policy "staff can view active staff members" on staff_members
  for select
  to authenticated
  using (
    active = true
    and (select auth.uid()) in (select id from staff_users)
  );

create policy "admins view shift logs" on shift_logs
  for select
  to authenticated
  using ((select auth.uid()) in (select id from admin_users));

-- Staff-facing views — deliberately NOT security_invoker (opposite of
-- availability_view): each runs as its owner, bypassing RLS/grants on
-- the base tables entirely, so the staff_users membership check and
-- guest-free column list baked into each view's own SQL are the entire
-- security boundary. Admin and staff sessions share the same Postgres
-- `authenticated` role, so this is the only mechanism that actually
-- restricts staff without also restricting admin.

create view staff_cleaning_laundry_feed as
select
  gr.id,
  gr.request_type,
  gr.status,
  gr.message,
  gr.created_at,
  gr.completed_by,
  b.room_id,
  r.name as room_name
from guest_requests gr
join bookings b on b.id = gr.booking_id
join rooms r on r.id = b.room_id
where gr.request_type in ('cleaning', 'laundry')
  and not (gr.request_type = 'cleaning' and gr.is_turnover)
  and (select auth.uid()) in (select id from staff_users);

alter view staff_cleaning_laundry_feed set (security_invoker = false);
grant select on staff_cleaning_laundry_feed to authenticated;

create view staff_checkout_schedule as
select
  b.id as booking_id,
  b.room_id,
  r.name as room_name,
  b.check_out,
  gr.id as cleaning_request_id,
  gr.status as cleaning_status
from bookings b
join rooms r on r.id = b.room_id
left join guest_requests gr
  on gr.booking_id = b.id
  and gr.request_type = 'cleaning'
  and gr.is_turnover = true
where b.checked_out_at is null
  and b.booking_status in ('Confirmed', 'Pending Verification')
  and b.check_out in (current_date, current_date + 1)
  and (select auth.uid()) in (select id from staff_users);

alter view staff_checkout_schedule set (security_invoker = false);
grant select on staff_checkout_schedule to authenticated;

create view staff_task_updates as
select id, request_type, status, completed_by
from guest_requests
where request_type in ('cleaning', 'laundry')
  and (select auth.uid()) in (select id from staff_users);

alter view staff_task_updates set (security_invoker = false);
grant select (id, request_type, status, completed_by) on staff_task_updates to authenticated;
grant update (status, completed_by) on staff_task_updates to authenticated;

create view staff_clock_updates as
select id, staff_member_id, clock_in_at, clock_out_at
from shift_logs
where clock_out_at is null
  and (select auth.uid()) in (select id from staff_users);

alter view staff_clock_updates set (security_invoker = false);
grant select (id, staff_member_id, clock_in_at, clock_out_at) on staff_clock_updates to authenticated;
grant update (clock_out_at) on staff_clock_updates to authenticated;
