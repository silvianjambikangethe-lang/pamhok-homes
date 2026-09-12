-- Laundry now has a real payment step: once an item reaches "Ready",
-- staff can no longer self-advance it to "Returned" — an admin sets a
-- price, the guest pays (M-Pesa/PayPal/manual), and only then can the
-- item be marked Returned. These columns track that charge separately
-- from the booking's own payment_status/total_amount, since a booking
-- can have its stay payment and a laundry charge in flight at the same
-- time and they must never collide.
alter table guest_requests
  add column if not exists laundry_amount numeric(10,2),
  add column if not exists laundry_currency text,
  -- null = no price set yet; 'Pending' = priced, awaiting payment;
  -- 'Paid'; 'Failed' = an attempt (M-Pesa) came back unsuccessful, still
  -- retriable.
  add column if not exists laundry_payment_status text,
  add column if not exists laundry_payment_method text, -- 'mpesa' | 'paypal' | 'manual'
  add column if not exists laundry_payment_reference text,
  add column if not exists laundry_paid_at timestamptz;

-- Re-created to surface the new columns to staff (display only — pricing
-- and marking paid are admin-only actions, done against the base table
-- via the RLS-bound admin session, never through this view). Re-running
-- CREATE OR REPLACE VIEW resets security_invoker to its default, so this
-- must re-apply the same settings the view already had (see the
-- 2026-08-27 fix that first caught this exact gotcha).
-- New columns are appended at the end, not inserted before room_id/
-- room_name — CREATE OR REPLACE VIEW requires the existing column list
-- to stay byte-for-byte identical in name, type, and position; it can
-- only ever ADD columns at the end, never insert or reorder them.
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
  gr.laundry_payment_status
from guest_requests gr
join bookings b on b.id = gr.booking_id
join rooms r on r.id = b.room_id
where gr.request_type in ('cleaning', 'laundry')
  and not (gr.request_type = 'cleaning' and gr.is_turnover)
  and (select auth.uid()) in (select id from staff_users);

alter view staff_cleaning_laundry_feed set (security_invoker = false);
revoke all on staff_cleaning_laundry_feed from authenticated;
grant select on staff_cleaning_laundry_feed to authenticated;
