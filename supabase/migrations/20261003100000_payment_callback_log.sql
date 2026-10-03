-- One row per reply Jenga sends back to jenga-pgw-callback, so a payment that
-- does not complete (card or M-Pesa) can be diagnosed from what Jenga actually
-- said. Private: RLS on with no policies, so only the service role can touch it.
-- Holds no card data (Jenga's signed blob is stored as a length only).
create table if not exists public.payment_callback_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reference text,
  status text,
  response_status text,
  channel text,
  amount numeric,
  params jsonb
);
alter table public.payment_callback_log enable row level security;
create index if not exists payment_callback_log_created_at_idx
  on public.payment_callback_log (created_at desc);
