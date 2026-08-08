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

  -- ID verification gate
  id_document_path text,        -- private storage path, never a public URL
  id_selfie_path text,          -- private storage path for the matching selfie
  id_verification_status text not null default 'Not Submitted',
  -- 'Not Submitted' | 'Pending' | 'Verified' | 'Rejected'
  -- Auto-set to 'Verified' when the Smile ID Document Verification job
  -- passes on upload; stays 'Pending' (admin override via the verify
  -- route) when it fails, errors, or Smile ID isn't configured.
  id_verification_method text,  -- 'automatic' | 'manual_override', set once a status is reached
  -- Counts failed automated Smile ID attempts (upload-id route). Below 3,
  -- the guest portal offers a self-serve "try again"; at 3 it stops and
  -- booking_status flips to 'Pending Verification' for admin review — see
  -- /api/portal/[token]/upload-id/route.ts. A PDF upload or an
  -- unreachable/unconfigured Smile ID skips straight to admin review
  -- without spending an attempt, since there's no automated check to retry.
  id_verification_attempts int not null default 0,
  smile_id_result jsonb,         -- { success, resultCode, resultText, actions, checkedAt }

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
-- Guest-initiated requests (room service, cleaning, personal issues)
-- ------------------------------------------------------------
create table if not exists guest_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  request_type text not null,   -- 'cleaning' | 'assistance' | 'other' | 'laundry'
  message text,
  -- 'cleaning'/'assistance'/'other': 'Open' | 'Resolved'
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

-- Indexes for the calendar + admin dashboard
create index if not exists idx_bookings_room_dates on bookings (room_id, check_in, check_out);
create index if not exists idx_bookings_status on bookings (booking_status);
create index if not exists idx_bookings_payment_status on bookings (payment_status);
create index if not exists idx_bookings_access_token on bookings (access_token);

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
alter table login_attempts enable row level security;
alter table rate_limits enable row level security;

-- --- site_content: public can read; only admins can write ---
create policy "anyone can view site content" on site_content
  for select using (true);

create policy "admins manage site content" on site_content
  for all using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- --- social_links: public can read active links; admins manage all ---
create policy "anyone can view active social links" on social_links
  for select using (is_active = true);

create policy "admins manage social links" on social_links
  for all using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- --- business_expenses: admin-only, no public/guest access at all ---
create policy "admins manage business expenses" on business_expenses
  for all using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- --- rooms: public can browse active rooms; admins manage all ---
create policy "anyone can view active rooms" on rooms
  for select using (is_active = true);

create policy "admins manage rooms" on rooms
  for all using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- --- bookings: public can create; only admins can read/update directly ---
-- Guests never SELECT this table with the anon key. The guest portal
-- (door code, WiFi, ID upload, checkout) is served by a server-side API
-- route using the service-role key, keyed off the booking's access_token —
-- never an open SELECT policy, since this table holds ID document paths.
create policy "anyone can create a booking" on bookings
  for insert with check (true);

create policy "admins manage bookings" on bookings
  for all using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- --- guests: public can create; only admins can read ---
create policy "anyone can create a guest record" on guests
  for insert with check (true);

create policy "admins view guests" on guests
  for select using (auth.uid() in (select id from admin_users));

-- --- admin_users: a user can check and update their own admin membership ---
create policy "admins can read their own row" on admin_users
  for select using (auth.uid() = id);

create policy "admins can update their own row" on admin_users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- --- guest_requests: written by the service role from the guest portal
-- API route (validated via access_token, not a public policy); read/
-- resolved by admins only ---
create policy "admins manage guest requests" on guest_requests
  for all using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- --- reviews: public can read (displayed on the site); written by the
-- service role from the post-stay review link (validated via
-- access_token) ---
create policy "anyone can read reviews" on reviews
  for select using (true);

create policy "admins manage reviews" on reviews
  for all using (auth.uid() in (select id from admin_users))
  with check (auth.uid() in (select id from admin_users));

-- ============================================================
-- Availability — public can see booked/blocked date ranges per
-- room ONLY (no guest details, no payment/ID info).
--
-- The view runs security_invoker (not the default security_definer),
-- so it only ever sees what anon itself is allowed to see below — a
-- real column-level grant plus a row-level policy, not a permission
-- bypass. Nothing else in the app queries bookings as anon (every other
-- read/write goes through the service-role client or an authenticated
-- admin session), so this is the only door anon has into the table.
-- ============================================================
revoke select on bookings from anon;
grant select (room_id, check_in, check_out, booking_status) on bookings to anon;

create policy "anon can view availability rows" on bookings
  for select
  to anon
  using (booking_status in ('Confirmed', 'Blocked', 'Pending Verification'));

create or replace view availability_view as
  select room_id, check_in, check_out, booking_status
  from bookings
  where booking_status in ('Confirmed', 'Blocked', 'Pending Verification');

alter view availability_view set (security_invoker = true);

grant select on availability_view to anon, authenticated;

-- ============================================================
-- Private storage bucket for national ID uploads.
-- No public policies are attached — access is exclusively via the
-- service-role key from server-side API routes (upload during guest
-- portal Step 1; signed-URL viewing from the admin dashboard).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

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
-- 1. Create your login in Supabase Dashboard > Authentication > Users
--    ("Add user"), or sign up once a sign-up flow exists.
-- 2. Then run, with your real user id (from that Users table) and email:
--
--   insert into admin_users (id, email) values ('<your-auth-user-id>', 'you@example.com');
-- ============================================================
