-- Backs the Expenses page's "Clear" button: records when a recurring bill
-- (Supabase, domain, hosting, etc.) was last marked paid, alongside the
-- next_due_date that same action advances by one billing cycle.
alter table business_expenses add column if not exists last_paid_at timestamptz;
