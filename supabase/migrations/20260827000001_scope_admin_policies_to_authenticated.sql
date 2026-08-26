-- Supabase advisor (multiple_permissive_policies): these five "admins
-- manage X" policies were scoped `TO public`, meaning they apply to every
-- Postgres role -- including anon and internal roles like
-- authenticator/dashboard_user -- alongside a separate anon-facing
-- read/insert policy for the same table+action. Both permissive policies
-- then had to be evaluated on every matching query.
--
-- Real admin sessions are always Supabase's `authenticated` role (this
-- app's guests never hold a Supabase Auth session -- they use the
-- access_token URL pattern instead), and server code that needs to bypass
-- RLS entirely already uses the service_role client, which ignores RLS
-- policies regardless of role scoping. So restricting these five policies
-- to `authenticated` removes the anon-role overlap (and the internal-role
-- overlap, since those aren't `authenticated` either) without changing
-- who can actually do what.

alter policy "admins manage bookings" on public.bookings
  to authenticated;

alter policy "admins manage reviews" on public.reviews
  to authenticated;

alter policy "admins manage rooms" on public.rooms
  to authenticated;

alter policy "admins manage site content" on public.site_content
  to authenticated;

alter policy "admins manage social links" on public.social_links
  to authenticated;
