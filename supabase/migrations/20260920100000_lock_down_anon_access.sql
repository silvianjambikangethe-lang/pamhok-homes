-- 2026-09-20 security lockdown: an anonymous visitor (anyone holding the
-- public API key that ships in every page's JavaScript) could, straight
-- against the database API:
--   * read the door code + WiFi password of every active room (rooms
--     SELECT policy + table-wide column grant)
--   * INSERT a booking with any columns — payment_status 'Paid',
--     id_verification_status 'Verified', an access_token of their choosing
--     (bookings INSERT policy "anyone can create a booking", WITH CHECK true)
--   * INSERT guests
--   * INSERT into guest_requests through the owner-privileged
--     staff_task_updates view (bypasses RLS)
-- Root cause: Supabase's default privileges grant every new table/view in
-- public to anon, and the earlier staff lockdown only narrowed
-- `authenticated`. The real app never needs any of this: every write goes
-- through server routes using the service-role key (which bypasses grants).

-- 1. rooms: anon may read the public listing columns only.
revoke all on public.rooms from anon;
grant select (
  id, slug, name, description, price_per_night, currency,
  max_guests, is_active, display_order, created_at, photo_urls, amenities,
  bed_config, photo_labels
) on public.rooms to anon;

-- 2. The anonymous INSERT policies the app never used.
drop policy if exists "anyone can create a booking" on public.bookings;
drop policy if exists "anyone can create a guest record" on public.guests;

-- 3. Nothing anonymous needs to write, delete or truncate anywhere.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;
revoke truncate, references, trigger
  on all tables in schema public from authenticated;

-- 4. Sensitive tables and the staff views: no anonymous read at all.
revoke select on
  public.admin_users, public.blocked_guest_names, public.business_expenses,
  public.guest_requests, public.guests, public.login_attempts,
  public.rate_limits, public.shift_logs, public.staff_users,
  public.staff_members, public.staff_checkout_schedule,
  public.staff_cleaning_laundry_feed, public.staff_clock_updates,
  public.staff_task_updates
from anon;

-- Deliberately kept for anon (public site): SELECT on rooms (columns
-- above), reviews, site_content, social_links, availability_view, and the
-- column-level SELECT on bookings that availability_view (security_invoker)
-- needs.
