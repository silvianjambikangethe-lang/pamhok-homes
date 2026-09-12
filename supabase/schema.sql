-- ============================================================
-- Pamhok Homes — Database Schema (v2, multi-room)
-- Run this in your Supabase project: SQL Editor > New Query
--
-- Extends the original single-property schema handed off in
-- README_1.md with a `rooms` table (Pamhok Homes has multiple
-- bookable rooms/units, not one single listing) and an
-- `admin_users` table so the admin dashboard can be gated by
-- Row Level Security tied to a real Supabase Auth user id,
-- not just a frontend redirect.
--
-- Kept in sync with the live database by hand (not by CLI push —
-- schema changes here are applied via the Supabase MCP tool, see
-- supabase/migrations/ for the individual dated changes). If you
-- ever suspect drift, the source of truth is always the live
-- project, not this file — diff against it with list_tables /
-- pg_policies / pg_get_viewdef before trusting this script.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Rooms / units guests can book
-- ------------------------------------------------------------
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price_per_night numeric(10,2) not null,
  currency text not null default 'KES',
  max_guests int not null default 2,           -- business policy: capped at 2 for every room, no exceptions (BookingWidget's guest checker enforces this in the UI regardless of this value)
  bed_config text not null default '',
  amenities text[] not null default '{}',
  photo_labels text[] not null default '{}',   -- placeholder labels, shown until photo_urls has real uploads
  photo_urls text[] not null default '{}',     -- real uploaded photos, editable from /admin/rooms
  door_code text,                              -- property-wide unlock code, editable from /admin/rooms
  wifi_password text,
  wifi_network_name text,                      -- WiFi SSID guests connect to, editable from /admin/rooms
  display_order int not null default 0,        -- controls listing order on /rooms and /admin/rooms (lower first)
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Guests who book (separate from admin auth)
-- ------------------------------------------------------------
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,                   -- optional: manual admin bookings may not collect one
  phone text,                   -- nulled out after checkout (privacy cleanup)
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Admins (owner/staff) — links to Supabase Auth users.
-- Membership in this table is what RLS policies check, so
-- "is this user an admin" is a database fact, not a client claim.
-- ------------------------------------------------------------
create table if not exists admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  -- Required once, on first dashboard login (see /admin/whatsapp-setup) —
  -- powers the guest-facing "Contact Host" WhatsApp button (Footer,
  -- Contact page, guest portal), not any automated alerting.
  whatsapp_phone text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Login attempt tracking for /admin/login — server-side rate limiting
-- keyed by (normalized) email, checked before Supabase Auth is even
-- called. No RLS policies at all: this table only ever exists before a
-- session does, so it's written exclusively via the service-role client
-- from /api/admin/login.
-- ------------------------------------------------------------
create table if not exists login_attempts (
  email text primary key,
  attempt_count int not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Passkey (WebAuthn) login for /admin — a hand-rolled ceremony (see
-- src/lib/webauthn.ts), not Supabase's built-in MFA system, since MFA
-- requires password sign-in FIRST and webauthn as a second factor —
-- the opposite of "try biometrics first, password only as fallback".
-- No RLS policies on either table, same reasoning as login_attempts:
-- both are service-role-only, written before any session exists.
-- ------------------------------------------------------------
create table if not exists passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  -- Signature counter for basic cloned-authenticator detection — most
  -- platform authenticators (Touch ID, Windows Hello) always report 0,
  -- which verifyAuthenticationResponse handles correctly on its own.
  counter bigint not null default 0,
  device_name text,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Short-lived challenge storage bridging a ceremony's two requests
-- (options, then verify) — Vercel's serverless functions have no
-- in-process memory to hold this between calls. Rows are deleted
-- immediately after a successful verify; the "options" endpoints sweep
-- anything older than 5 minutes before inserting a new one.
create table if not exists passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  type text not null check (type in ('registration', 'authentication')),
  challenge text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Basic fixed-window rate limiting for public forms (booking, contact,
-- review) - same pattern as login_attempts, generalized to any
-- (route, identifier) pair. Written exclusively via the service-role
-- client from the relevant API routes.
-- ------------------------------------------------------------
create table if not exists rate_limits (
  key text primary key,        -- e.g. "booking:203.0.113.5"
  attempt_count int not null default 1,
  window_started_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Core bookings table (drives calendar + payments + guest portal)
-- ------------------------------------------------------------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete restrict,
  guest_id uuid references guests(id) on delete set null,

  -- Guest portal is accessed via this token (e.g. /portal/<access_token>),
  -- not a guest login — the confirmation email/page links here directly.
  access_token uuid not null default gen_random_uuid() unique,

  -- Short human-readable code (e.g. PMH-7K2N9X), generated on creation.
  -- Shown on the verification pass, guest portal, and admin bookings table.
  booking_reference text unique,

  -- Second reference code shown only on the guest's verification pass:
  -- REF{month}/{day}-{room display_order}-{yy} from check-in date + room.
  -- Computed once at booking creation and frozen here — NOT derived live
  -- from the room's current display_order, since that's admin-editable
  -- and would otherwise let the same booking's reference silently change
  -- if rooms are ever reordered later.
  pass_reference text,

  check_in date not null,
  check_out date not null,

  total_amount numeric(10,2) not null,
  currency text not null default 'KES',

  -- 'Pending' | 'Paid' | 'Failed' | 'Refunded'
  payment_status text not null default 'Pending',
  -- 'mpesa' | 'paypal' | 'manual'
  payment_method text,
  payment_reference text,       -- M-Pesa receipt number / PayPal capture id / etc
  paid_at timestamptz,

  -- 'Confirmed' | 'Cancelled' | 'Blocked' | 'Pending Verification'
  -- (Blocked = host-blocked dates, no guest; Pending Verification = paid-or-
  -- unpaid booking held while an admin manually reviews ID verification —
  -- see availability_view below, which blocks this status too)
  booking_status text not null default 'Confirmed',
  block_note text,              -- only used when booking_status = 'Blocked'

  -- ID verification gate. Automated via Dojah document analysis
  -- (src/lib/dojah.ts) — front + back of the ID, no selfie/face-match — a
  -- guest gets 2 attempts (upload-id route) before the booking is flagged
  -- 'Pending' + booking_status 'Pending Verification' for manual admin
  -- review. A Dojah-side/config error falls back to the same manual-review
  -- path without spending an attempt.
  id_document_path text,           -- attempt 1's ID front photo — private storage path, never a public URL
  id_document_back_path text,      -- attempt 1's ID back photo — private storage path
  id_document_path_2 text,         -- attempt 2's ID front photo, only present if attempt 1 failed automatically
  id_document_back_path_2 text,    -- attempt 2's ID back photo, only present if attempt 1 failed automatically
  id_verification_status text not null default 'Not Submitted',
  -- 'Not Submitted' | 'Pending' | 'Verified' | 'Rejected'
  id_verification_method text,  -- 'automatic' | 'manual_override', set once a status is reached
  -- Automated Dojah attempts made this verification cycle (max 2 before
  -- manual-review escalation). See /api/portal/[token]/upload-id/route.ts.
  id_verification_attempts int not null default 0,
  id_verification_result jsonb,    -- attempt 1's Dojah result — { success, resultCode, resultText, actions, checkedAt }
  id_verification_result_2 jsonb,  -- attempt 2's Dojah result, only present if attempt 1 failed automatically

  -- Refund bookkeeping — set when an admin rejects a booking that was
  -- already paid (see /api/admin/bookings/[id]/verify). refund_status is
  -- only set when the refund needs attention: 'Needs Manual Refund' (e.g.
  -- M-Pesa, which has no refund API wired up) or 'Refund Failed' (a
  -- PayPal API refund attempt errored) — null once resolved.
  -- payment_status becomes 'Refunded' only once the refund is actually
  -- confirmed done (auto-success, or an admin manually marking it so).
  refund_status text,
  refund_amount numeric(10,2),
  refund_reference text,
  refunded_at timestamptz,

  -- A guest-requested stay extension is not applied to check_out until its
  -- payment is confirmed — these four columns hold the pending extension
  -- (and its 3-hour availability hold, see availability_view below) until
  -- payment_status becomes Paid, at which point it's folded into check_out
  -- and cleared. See src/lib/extension-hold.ts.
  pending_extension_check_out date,          -- the check_out that will be applied once payment confirms
  pending_extension_nights int,              -- extra nights requested, for display only
  pending_extension_amount numeric(10,2),    -- additional cost already folded into total_amount, kept separately so it can be cleanly subtracted back out if the hold expires or conflicts
  pending_extension_requested_at timestamptz, -- hold + payment window both expire 3 hours after this

  -- Door code / WiFi password live on `rooms`, not here — they're property
  -- details, not per-booking secrets. The guest portal shows them (once
  -- payment_status = 'Paid' AND id_verification_status = 'Verified') by
  -- reading straight from the booking's joined room.

  checked_out_at timestamptz,

  -- Set the moment the guest checks "I agree to the Terms & Privacy
  -- Policy," right before their payment is submitted — proof of consent,
  -- kept even if they retry payment (only ever set once, not overwritten).
  terms_accepted_at timestamptz,

  created_at timestamptz default now(),

  constraint valid_dates check (check_out > check_in)
);

-- ------------------------------------------------------------
-- Guest-initiated requests (room service, cleaning, personal issues) —
-- also doubles as the maintenance-staff task list (see the "Maintenance
-- staff" section below, which adds completed_by/is_turnover columns
-- once staff_members exists): a staff-completed cleaning/laundry task is
-- a row here, not a separate table, so a guest's request and staff
-- marking it done are always the same row.
-- ------------------------------------------------------------
create table if not exists guest_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  request_type text not null,   -- 'cleaning' | 'assistance' | 'other' | 'laundry' | 'extension'
  message text,
  -- 'cleaning': 'Open' | 'In Progress' | 'Resolved'
  -- 'assistance'/'other'/'extension': 'Open' | 'Resolved'
  -- 'laundry': 'Open' | 'Picked Up' | 'Cleaning' | 'Ready' | 'Returned' | 'Closed'
  status text not null default 'Open',
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Guest reviews, collected post-stay
-- ------------------------------------------------------------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  guest_display_name text,
  featured boolean not null default false,  -- admin-curated highlight, shown on the homepage
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Footer social media links — public reads active links only; admins
-- manage the full list (add/edit/reorder/toggle) from /admin/content.
-- ------------------------------------------------------------
create table if not exists social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null,       -- 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'twitter' | 'youtube'
  url text not null,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- The owner's own recurring service bills (domain, hosting, etc.) —
-- purely internal bookkeeping, no public or guest access at all. Powers
-- the /admin/expenses panel and the dormant 3-day renewal reminder.
-- ------------------------------------------------------------
create table if not exists business_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(10,2),
  currency text default 'KES',
  billing_cycle text not null,   -- 'monthly' | 'annual' | 'one-time'
  next_due_date date not null,
  notes text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Admin-maintained "do not book" list, checked against the booking name
-- at booking time (public booking flow and the admin's manual/walk-in
-- flow). full_name_normalized is precomputed (lowercased,
-- whitespace-collapsed) at write time since the check runs on every
-- booking attempt. Deliberately not named anything using bare "blocked"
-- -- bookings.booking_status already has a distinct "Blocked" value used
-- for calendar-date blocking, unrelated to this feature.
-- ------------------------------------------------------------
create table if not exists blocked_guest_names (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  full_name_normalized text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_blocked_guest_names_normalized
  on blocked_guest_names (full_name_normalized);

-- ------------------------------------------------------------
-- Admin-editable public site copy (homepage/about/amenities/contact).
-- One row per page/section; `value` holds that section's fields as
-- JSON, matching the admin dashboard's "one form per section" UX.
-- Public pages read this at request time; only admins can write it
-- (see RLS policies below, same admin-check pattern as `rooms`).
-- ------------------------------------------------------------
create table if not exists site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Maintenance staff — a second, restricted login for cleaners/laundry
-- staff, separate from admin_users on purpose (see the RLS section
-- below): admin_users membership grants blanket access via several
-- "admins manage X" policies, so a role column there would make staff
-- inherit full access to bookings/guests/payments. staff_users instead
-- gets its own table with none of those policies, and staff reach data
-- only through the purpose-built views further down.
-- ------------------------------------------------------------

-- The ONE shared Supabase Auth account every worker logs in with — not
-- one row per worker. Individual accountability comes from staff_members
-- (the "tap your name" roster) + guest_requests.completed_by /
-- shift_logs.staff_member_id, not from separate logins.
create table if not exists staff_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- The tap-list of worker names, managed by the host from the admin
-- dashboard. Deactivating someone (active = false) removes them from the
-- tap list immediately — no password reset needed, since there's no
-- per-worker password to reset.
create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  -- Checked when this worker's tile is tapped at /staff (see
  -- src/app/api/staff/select-worker/route.ts) — the one shared staff
  -- login only gates the device, this is what actually distinguishes one
  -- worker from another. Nullable for rows added before this existed;
  -- a null pin_hash rejects tap-in with a "no PIN set yet" error rather
  -- than granting access.
  pin_hash text,
  created_at timestamptz not null default now()
);

-- Clock in/out shift log, internal tracking only (never guest-facing).
create table if not exists shift_logs (
  id uuid primary key default gen_random_uuid(),
  -- on delete restrict: a worker with shift history can be deactivated
  -- (staff_members.active = false) but not hard-deleted, so the
  -- accountability trail this table exists for can't be destroyed.
  staff_member_id uuid not null references staff_members(id) on delete restrict,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now()
);

-- Now that staff_members exists, extend guest_requests for staff use.
alter table guest_requests
  -- Which tapped staff_members row advanced/completed this task — null
  -- for guest-initiated requests no staff member has touched yet, and
  -- always null for admin-resolved (non-staff) requests.
  add column if not exists completed_by uuid references staff_members(id) on delete set null,
  -- true only for the auto-generated checkout/turnover cleaning row a
  -- staff device creates from the Cleaning Schedule view — distinguishes
  -- it from a guest-initiated mid-stay cleaning request, since a booking
  -- can legitimately have both at once.
  add column if not exists is_turnover boolean not null default false;

-- Indexes for the calendar + admin dashboard
create index if not exists idx_bookings_room_dates on bookings (room_id, check_in, check_out);
create index if not exists idx_bookings_status on bookings (booking_status);
create index if not exists idx_bookings_payment_status on bookings (payment_status);
create index if not exists idx_bookings_access_token on bookings (access_token);
-- FK-covering indexes flagged by Supabase's performance advisor —
-- guest_id has no app query yet but is still the FK Postgres checks on
-- every guest write; the other two back real queries (portal.ts's
-- latestLaundryRequest lookup, the review-exists/review-count checks).
create index if not exists idx_bookings_guest_id on bookings (guest_id);
create index if not exists idx_guest_requests_booking_id on guest_requests (booking_id);
create index if not exists idx_reviews_booking_id on reviews (booking_id);
-- Covers room_id lookups on its own (the composite idx_bookings_room_dates
-- above requires check_in/check_out too to be used) — flagged separately
-- by the performance advisor.
create index if not exists idx_bookings_room_id on bookings (room_id);

create index if not exists idx_shift_logs_staff_member_id on shift_logs (staff_member_id);
-- Enforces "at most one open shift per worker" at the database level —
-- also what makes clock-in race-safe (two devices clocking the same
-- worker in within moments of each other get a clean unique-violation,
-- not two simultaneously open shifts).
create unique index if not exists shift_logs_one_open_per_worker
  on shift_logs (staff_member_id)
  where clock_out_at is null;

-- Prevents duplicate turnover-cleaning rows for the same checkout even
-- under two staff devices tapping "Start" on the same schedule item at
-- nearly the same moment, without blocking a booking from having
-- multiple separate guest-initiated cleaning requests over a long stay
-- (those all have is_turnover = false, outside this partial index).
create unique index if not exists guest_requests_turnover_unique
  on guest_requests (booking_id)
  where is_turnover = true and request_type = 'cleaning';

-- ============================================================
-- Row Level Security
-- ============================================================
alter table rooms enable row level security;
alter table bookings enable row level security;
alter table guests enable row level security;
alter table admin_users enable row level security;
alter table guest_requests enable row level security;
alter table reviews enable row level security;
alter table site_content enable row level security;
alter table social_links enable row level security;
alter table business_expenses enable row level security;
alter table blocked_guest_names enable row level security;
alter table login_attempts enable row level security;
alter table passkey_credentials enable row level security;
alter table passkey_challenges enable row level security;
alter table rate_limits enable row level security;
alter table staff_users enable row level security;
alter table staff_members enable row level security;
alter table shift_logs enable row level security;

-- Every policy below wraps auth.uid() as (select auth.uid()) — lets
-- Postgres cache it once per statement instead of re-evaluating per row
-- (Supabase performance advisor's InitPlan recommendation), pure
-- performance, no behavior change.

-- --- site_content: public can read; only admins can write ---
create policy "anyone can view site content" on site_content
  for select
  to anon
  using (true);

create policy "admins manage site content" on site_content
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

-- --- social_links: public can read active links; admins manage all ---
create policy "anyone can view active social links" on social_links
  for select
  to anon
  using (is_active = true);

create policy "admins manage social links" on social_links
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

-- --- business_expenses: admin-only, no public/guest access at all ---
create policy "admins manage business expenses" on business_expenses
  for all
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

-- --- blocked_guest_names: admin-only, no public/guest access at all ---
create policy "admins manage blocked guest names" on blocked_guest_names
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

-- --- rooms: public can browse active rooms; admins manage all ---
create policy "anyone can view active rooms" on rooms
  for select
  to anon
  using (is_active = true);

create policy "admins manage rooms" on rooms
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

-- --- bookings: public can create; only admins can read/update directly ---
-- Guests never SELECT this table with the anon key beyond the narrow
-- availability grant below. The guest portal (door code, WiFi, ID upload,
-- checkout) is served by a server-side API route using the service-role
-- key, keyed off the booking's access_token — never an open SELECT
-- policy, since this table holds ID document paths.
create policy "anyone can create a booking" on bookings
  for insert
  to anon
  with check (true);

create policy "admins manage bookings" on bookings
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

-- --- guests: public can create; only admins can read ---
create policy "anyone can create a guest record" on guests
  for insert with check (true);

create policy "admins view guests" on guests
  for select using ((select auth.uid()) in (select id from admin_users));

-- --- admin_users: a user can check and update their own admin membership ---
create policy "admins can read their own row" on admin_users
  for select using ((select auth.uid()) = id);

create policy "admins can update their own row" on admin_users
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- --- guest_requests: written by the service role from the guest portal
-- API route (validated via access_token, not a public policy); read/
-- resolved by admins only ---
create policy "admins manage guest requests" on guest_requests
  for all
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

-- --- reviews: public can read (displayed on the site); written by the
-- service role from the post-stay review link (validated via
-- access_token) ---
create policy "anyone can read reviews" on reviews
  for select
  to anon
  using (true);

create policy "admins manage reviews" on reviews
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

-- --- staff_users: a staff session can check its own membership, same
-- self-row-only shape as admin_users. No write policy at all — the host
-- edits this account exclusively via the service-role client from
-- /api/admin/staff-credentials, never through an authenticated session. ---
create policy "staff can read their own row" on staff_users
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- --- staff_members: admins manage the full roster; staff can only see
-- active names (for the tap screen) — a deactivated worker is genuinely
-- invisible to a staff session, not just hidden by the UI. Row-level
-- policy is enough for name/active/created_at, no view needed — but
-- pin_hash is a credential, not just PII, and RLS only scopes rows, not
-- columns: the policy below correctly lets any staff session see every
-- active row, which would include pin_hash too without the explicit
-- column-level lockdown after it (2026-09-12 fix — this was the gap that
-- let one staff session read every worker's PIN hash straight off the
-- public REST API and crack it offline). ---
create policy "admins manage staff members" on staff_members
  for all
  to authenticated
  using ((select auth.uid()) in (select id from admin_users))
  with check ((select auth.uid()) in (select id from admin_users));

create policy "staff can view active staff members" on staff_members
  for select
  to authenticated
  using (
    active = true
    and (select auth.uid()) in (select id from staff_users)
  );

-- pin_hash must never be SELECTable by anon/authenticated — only
-- service-role (used server-side in /api/staff/select-worker) needs to
-- read it. Postgres's default privileges grant every role broad table
-- access on a new table regardless of RLS, and a column-specific revoke
-- can't override an existing table-wide grant, so this has to revoke
-- everything on the table first and re-grant only what each role
-- legitimately needs — same pattern as the staff_* view lockdown above.
revoke all on staff_members from authenticated;
revoke all on staff_members from anon;

grant select (id, name, active, created_at) on staff_members to authenticated;
grant insert (name, pin_hash) on staff_members to authenticated;
grant update (name, active, pin_hash) on staff_members to authenticated;

-- --- shift_logs: admins get read access for reporting. Deliberately NO
-- staff-facing policy on this base table at all — every staff clock
-- action goes through the staff_clock_updates view further down, so a
-- staff session hitting this table directly gets nothing back (RLS
-- defaults to deny-all once enabled with no matching policy). ---
create policy "admins view shift logs" on shift_logs
  for select
  to authenticated
  using ((select auth.uid()) in (select id from admin_users));

-- ============================================================
-- Availability — public can see booked/blocked date ranges per
-- room ONLY (no guest details, no payment/ID info), including a
-- synthetic extra range for a booking's *pending* stay-extension hold
-- (see the pending_extension_* columns above) so the calendar blocks
-- those nights for other guests during the guest's ~3 hour payment
-- window, even though check_out itself hasn't moved yet.
--
-- The view runs security_invoker (not the default security_definer),
-- so it only ever sees what anon itself is allowed to see below — a
-- real column-level grant plus row-level policies, not a permission
-- bypass. Nothing else in the app queries bookings as anon (every other
-- read/write goes through the service-role client or an authenticated
-- admin session), so this is the only door anon has into the table.
-- ============================================================
revoke select on bookings from anon;
grant select (
  room_id, check_in, check_out, booking_status,
  payment_status, pending_extension_check_out, pending_extension_requested_at
) on bookings to anon;

create policy "anon can view availability rows" on bookings
  for select
  to anon
  using (booking_status in ('Confirmed', 'Blocked', 'Pending Verification'));

create or replace view availability_view as
  select room_id, check_in, check_out, booking_status
  from bookings
  where booking_status in ('Confirmed', 'Blocked', 'Pending Verification')
  union all
  select room_id, check_out as check_in, pending_extension_check_out as check_out, booking_status
  from bookings
  where pending_extension_check_out is not null
    and payment_status = 'Pending'
    and pending_extension_requested_at > (now() - interval '3 hours')
    and booking_status = 'Confirmed';

alter view availability_view set (security_invoker = true);

grant select on availability_view to anon, authenticated;

-- ============================================================
-- Maintenance staff task views.
--
-- Admin and staff sessions both authenticate as the SAME Postgres
-- `authenticated` role — unlike anon vs authenticated above, there is no
-- way to GRANT a column/row restriction that applies to staff but not
-- admin on the base tables themselves. So these views deliberately do
-- NOT use security_invoker (the opposite of availability_view above):
-- security_invoker = false means each view runs as ITS OWNER, which
-- bypasses RLS/grants on the base tables entirely — the staff_users
-- membership check and the guest-free column list baked into each
-- view's own SQL are the entire security boundary. Because a view is
-- its own relation, it gets its own independent GRANT, genuinely
-- narrower than guest_requests'/shift_logs' own (unrestricted,
-- admin-facing) grants. Staff get zero RLS policies on bookings,
-- guests, or the base guest_requests/shift_logs tables at all — a raw
-- REST call from a staff session against those tables returns nothing,
-- by construction, not by app-code discipline.
--
-- Every view below is `revoke all` THEN a narrow `grant` — Supabase's
-- default privileges give every new relation full INSERT/UPDATE/DELETE/
-- TRUNCATE to `authenticated` automatically, and privileges are
-- additive, so a narrow grant alone (with no revoke first) grants
-- nothing extra-restrictive: `authenticated` would still have the
-- default full access underneath it. Confirmed this the hard way against
-- the live project (caught in verification, before any real staff
-- session existed) — mirrors exactly why bookings -> anon needed its own
-- explicit revoke before availability_view's narrow grant above.
-- ============================================================

-- Ad-hoc cleaning + laundry requests, guest-free. Excludes turnover rows
-- (is_turnover) on purpose — those surface on the Cleaning Schedule view
-- instead, so nothing shows in both places at once.
create view staff_cleaning_laundry_feed as
select
  gr.id,
  gr.request_type,
  gr.status,
  gr.message,
  gr.created_at,
  gr.completed_by,
  b.room_id,
  r.name as room_name
from guest_requests gr
join bookings b on b.id = gr.booking_id
join rooms r on r.id = b.room_id
where gr.request_type in ('cleaning', 'laundry')
  and not (gr.request_type = 'cleaning' and gr.is_turnover)
  and (select auth.uid()) in (select id from staff_users);

alter view staff_cleaning_laundry_feed set (security_invoker = false);
revoke all on staff_cleaning_laundry_feed from authenticated;
grant select on staff_cleaning_laundry_feed to authenticated;

-- Checkout-driven turnover schedule, guest-free — computed live from
-- bookings (today/tomorrow checkouts not yet checked out), no cron
-- needed, always in sync with real booking data. cleaning_status/
-- cleaning_request_id are null until a staff device first taps a status
-- on a schedule item (see /api/staff/schedule/[bookingId]/status).
create view staff_checkout_schedule as
select
  b.id as booking_id,
  b.room_id,
  r.name as room_name,
  b.check_out,
  gr.id as cleaning_request_id,
  gr.status as cleaning_status
from bookings b
join rooms r on r.id = b.room_id
left join guest_requests gr
  on gr.booking_id = b.id
  and gr.request_type = 'cleaning'
  and gr.is_turnover = true
where b.checked_out_at is null
  and b.booking_status in ('Confirmed', 'Pending Verification')
  and b.check_out in (current_date, current_date + 1)
  and (select auth.uid()) in (select id from staff_users);

alter view staff_checkout_schedule set (security_invoker = false);
revoke all on staff_checkout_schedule from authenticated;
grant select on staff_checkout_schedule to authenticated;

-- Narrow, single-table updatable view for advancing an EXISTING cleaning/
-- laundry request's status. The column-level grants below apply to THIS
-- view relation only — completely independent of guest_requests' own
-- grants, so admin's ability to edit message/booking_id on the base
-- table is untouched.
create view staff_task_updates as
select id, request_type, status, completed_by
from guest_requests
where request_type in ('cleaning', 'laundry')
  and (select auth.uid()) in (select id from staff_users);

alter view staff_task_updates set (security_invoker = false);
revoke all on staff_task_updates from authenticated;
grant select (id, request_type, status, completed_by) on staff_task_updates to authenticated;
grant update (status, completed_by) on staff_task_updates to authenticated;

-- Narrow updatable view for clocking out. Only ever exposes currently-
-- OPEN shifts, so it doubles as "am I clocked in" for the Clock In/Out
-- page's read.
create view staff_clock_updates as
select id, staff_member_id, clock_in_at, clock_out_at
from shift_logs
where clock_out_at is null
  and (select auth.uid()) in (select id from staff_users);

alter view staff_clock_updates set (security_invoker = false);
revoke all on staff_clock_updates from authenticated;
grant select (id, staff_member_id, clock_in_at, clock_out_at) on staff_clock_updates to authenticated;
grant update (clock_out_at) on staff_clock_updates to authenticated;

-- ============================================================
-- Storage buckets
-- ============================================================

-- Private bucket for national ID uploads. No public policies are
-- attached — access is exclusively via the service-role key from
-- server-side API routes (upload during guest portal Step 1;
-- signed-URL viewing from the admin dashboard).
insert into storage.buckets (id, name, public)
values ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

-- Public bucket for room/site photos and branding (logo, hero images,
-- etc.) — served straight through next/image, no signed URLs needed.
-- Uploaded from the admin dashboard's various content forms
-- (see src/app/api/admin/upload-image/route.ts).
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

create policy "anyone can view site images" on storage.objects
  for select using (bucket_id = 'site-images');

create policy "admins manage site images" on storage.objects
  for all
  using (bucket_id = 'site-images' and auth.uid() in (select id from admin_users))
  with check (bucket_id = 'site-images' and auth.uid() in (select id from admin_users));

-- Public bucket for short site videos (homepage tour, About Us, driving
-- directions) — uploaded directly from the browser to Supabase Storage
-- (see src/components/admin/VideoUploadField.tsx), NOT proxied through a
-- Next.js API route: Vercel's serverless functions cap request bodies at
-- ~4.5MB, far too small for video, so the browser's own Supabase client
-- (already carrying the admin's session cookie) uploads straight to
-- Storage and RLS below is what actually enforces "admin only" -- same
-- pattern the existing browser-side admin sign-out/payment-polling calls
-- already use. file_size_limit/allowed_mime_types are enforced by
-- Supabase Storage itself, not just client-side validation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-videos', 'site-videos', true, 104857600, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

create policy "anyone can view site videos" on storage.objects
  for select using (bucket_id = 'site-videos');

create policy "admins manage site videos" on storage.objects
  for all
  using (bucket_id = 'site-videos' and auth.uid() in (select id from admin_users))
  with check (bucket_id = 'site-videos' and auth.uid() in (select id from admin_users));

-- ============================================================
-- Sample rooms — replace name/price/description with the real thing,
-- or manage rooms directly from the Supabase table editor (there is no
-- dedicated "add room" screen in the admin dashboard, since the brief
-- didn't call for one). Set door_code/wifi_password per room so newly
-- verified bookings pick up sane defaults.
-- ============================================================
insert into rooms (name, slug, description, price_per_night, max_guests, bed_config, amenities, photo_labels, door_code, wifi_password, display_order)
values
  ('The Garden Room', 'garden-room',
   'A cozy double room with soft natural light and garden views — perfect for solo travelers or couples.',
   4500, 2, '1 Queen bed',
   array['Free WiFi','Free Parking','Full Kitchen Access','In-Room Safe','Dry Cleaning'],
   array['Garden Room bed','Garden Room desk','Ensuite bathroom'],
   '1234', 'pamhok-guest', 1),
  ('The Family Suite', 'family-suite',
   'Two connected bedrooms with a shared living area — spacious enough for families or small groups.',
   8500, 4, '1 Queen bed + 2 Singles',
   array['Free WiFi','Free Parking','Full Kitchen Access','In-Room Safe','Dry Cleaning'],
   array['Family Suite living area','Family Suite bedroom','Second bedroom'],
   '5678', 'pamhok-guest', 2),
  ('The Studio Loft', 'studio-loft',
   'A bright, modern studio with its own kitchenette — ideal for remote workers or short business trips.',
   5500, 2, '1 Queen bed',
   array['Free WiFi','Free Parking','Full Kitchen Access','In-Room Safe'],
   array['Studio Loft interior','Studio Loft workspace','Kitchenette'],
   '9012', 'pamhok-guest', 3)
on conflict (slug) do nothing;

-- ============================================================
-- Making yourself an admin:
--
-- Option A — scripted (recommended): run
--   node scripts/bootstrap-admin.mjs you@example.com 'a-strong-password'
-- with SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL set in your
-- environment. Creates the Auth user and the matching admin_users row in
-- one step.
--
-- Option B — manual:
-- 1. Create your login in Supabase Dashboard > Authentication > Users
--    ("Add user"), or sign up once a sign-up flow exists.
-- 2. Then run, with your real user id (from that Users table) and email:
--
--   insert into admin_users (id, email) values ('<your-auth-user-id>', 'you@example.com');
-- ============================================================

-- ============================================================
-- Setting up the shared maintenance-staff login (one time, after the
-- schema above exists):
--
--   node scripts/bootstrap-staff.mjs staff@pamhokhomes.com 'a-strong-password'
--
-- with SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL set in your
-- environment. Creates the Auth user and the matching staff_users row in
-- one step — this is the ONE shared account every worker logs in with,
-- not one per worker. Add worker names for the tap screen from
-- /admin/settings once logged in as the host.
-- ============================================================
