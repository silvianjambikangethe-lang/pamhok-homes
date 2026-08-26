-- Supabase advisor (auth_rls_initplan): auth.uid() was being re-evaluated
-- per row in these policies. Wrapping it as (select auth.uid()) lets
-- Postgres evaluate it once per query instead, via an InitPlan. Purely a
-- performance change -- the boolean result of every USING/WITH CHECK
-- expression is unchanged, so access semantics are identical before and
-- after.

alter policy "admins can read their own row" on public.admin_users
  using ((select auth.uid()) = id);

alter policy "admins can update their own row" on public.admin_users
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "admins manage bookings" on public.bookings
  using ((select auth.uid()) in (select admin_users.id from admin_users))
  with check ((select auth.uid()) in (select admin_users.id from admin_users));

alter policy "admins manage business expenses" on public.business_expenses
  using ((select auth.uid()) in (select admin_users.id from admin_users))
  with check ((select auth.uid()) in (select admin_users.id from admin_users));

alter policy "admins manage guest requests" on public.guest_requests
  using ((select auth.uid()) in (select admin_users.id from admin_users))
  with check ((select auth.uid()) in (select admin_users.id from admin_users));

alter policy "admins view guests" on public.guests
  using ((select auth.uid()) in (select admin_users.id from admin_users));

alter policy "admins manage reviews" on public.reviews
  using ((select auth.uid()) in (select admin_users.id from admin_users))
  with check ((select auth.uid()) in (select admin_users.id from admin_users));

alter policy "admins manage rooms" on public.rooms
  using ((select auth.uid()) in (select admin_users.id from admin_users))
  with check ((select auth.uid()) in (select admin_users.id from admin_users));

alter policy "admins manage site content" on public.site_content
  using ((select auth.uid()) in (select admin_users.id from admin_users))
  with check ((select auth.uid()) in (select admin_users.id from admin_users));

alter policy "admins manage social links" on public.social_links
  using ((select auth.uid()) in (select admin_users.id from admin_users))
  with check ((select auth.uid()) in (select admin_users.id from admin_users));

-- Supabase advisor (unindexed_foreign_keys): bookings.room_id had no
-- covering index.
create index if not exists idx_bookings_room_id on public.bookings (room_id);
