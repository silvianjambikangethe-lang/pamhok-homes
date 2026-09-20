-- Supabase's default privileges automatically grant every new table, view,
-- sequence and function created in `public` to anon. That default is why
-- each table (and the staff views) ended up wide open to anonymous
-- visitors before 20260920100000_lock_down_anon_access.sql, and it would
-- silently reopen the same hole for every future table. Turn it off for
-- the role that creates this project's objects (postgres). A new object
-- now needs an explicit `grant ... to anon` if the public site truly reads
-- it. (The same change for supabase_admin is refused — it's Supabase-
-- internal and doesn't create this project's tables.)
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
