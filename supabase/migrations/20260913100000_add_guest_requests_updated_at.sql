-- Who last advanced status/completed_by, and when — set explicitly by
-- every route that touches either (this project sets timestamps in
-- application code rather than a DB trigger, matching site_content's own
-- updated_at). Lets the admin see e.g. "Returned by <staff name> at
-- <time>" by joining completed_by to staff_members.
alter table guest_requests add column if not exists updated_at timestamptz not null default now();

-- Re-created to surface updated_at to staff (display only) and to let
-- the staff status route set it. Re-running CREATE OR REPLACE VIEW
-- resets security_invoker to its default, so this must re-apply the
-- same settings the views already had — and the new column has to be
-- appended at the end, not inserted before existing columns, since
-- CREATE OR REPLACE VIEW requires the existing column list to stay
-- byte-for-byte identical in name, type, and position.
create or replace view staff_task_updates as
select id, request_type, status, completed_by, updated_at
from guest_requests
where request_type in ('cleaning', 'laundry')
  and (select auth.uid()) in (select id from staff_users);

alter view staff_task_updates set (security_invoker = false);
revoke all on staff_task_updates from authenticated;
grant select (id, request_type, status, completed_by, updated_at) on staff_task_updates to authenticated;
grant update (status, completed_by, updated_at) on staff_task_updates to authenticated;

create or replace view staff_cleaning_laundry_feed as
select
  gr.id,
  gr.request_type,
  gr.status,
  gr.message,
  gr.created_at,
  gr.completed_by,
  b.room_id,
  r.name as room_name,
  gr.laundry_amount,
  gr.laundry_currency,
  gr.laundry_payment_status,
  gr.updated_at
from guest_requests gr
join bookings b on b.id = gr.booking_id
join rooms r on r.id = b.room_id
where gr.request_type in ('cleaning', 'laundry')
  and not (gr.request_type = 'cleaning' and gr.is_turnover)
  and (select auth.uid()) in (select id from staff_users);

alter view staff_cleaning_laundry_feed set (security_invoker = false);
revoke all on staff_cleaning_laundry_feed from authenticated;
grant select on staff_cleaning_laundry_feed to authenticated;
