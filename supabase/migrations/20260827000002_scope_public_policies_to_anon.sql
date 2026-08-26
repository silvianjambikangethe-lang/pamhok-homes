-- Second half of the multiple_permissive_policies fix (see the previous
-- migration). These five guest-facing policies were still `TO public`,
-- so they now overlap with the `authenticated`-scoped admin policies for
-- the `authenticated` role specifically. Real guests are always Supabase's
-- `anon` role (no login), and admins already get full access to these
-- same rows through their own "admins manage X" ALL policy, so scoping
-- these to `anon` removes the last overlap with no behavior change.

alter policy "anyone can create a booking" on public.bookings
  to anon;

alter policy "anyone can read reviews" on public.reviews
  to anon;

alter policy "anyone can view active rooms" on public.rooms
  to anon;

alter policy "anyone can view site content" on public.site_content
  to anon;

alter policy "anyone can view active social links" on public.social_links
  to anon;
