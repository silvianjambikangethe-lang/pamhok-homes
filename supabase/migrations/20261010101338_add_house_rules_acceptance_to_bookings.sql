alter table public.bookings
  add column if not exists house_rules_accepted_at timestamptz,
  add column if not exists house_rules_version text;
