-- Basic fixed-window rate limiting for public forms (booking, contact,
-- review) - the same pattern login_attempts already uses for admin
-- login, generalized to any (route, identifier) pair. Serverless
-- functions have no persistent memory between invocations, so this has
-- to live in the database rather than an in-process counter.
create table if not exists rate_limits (
  key text primary key,        -- e.g. "booking:203.0.113.5"
  attempt_count int not null default 1,
  window_started_at timestamptz not null default now()
);

alter table rate_limits enable row level security;
-- No policies: accessed exclusively via the service-role client from
-- API routes, same as login_attempts.
