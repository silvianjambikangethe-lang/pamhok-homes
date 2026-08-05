# Pamhok Homes — Handoff / Status Summary

Last updated: 2026-08-06. Written for continuing this project in a **new chat** —
paste a link to this file (or its contents) so the new session has full context.
This supersedes the previous version of this file (dated 2026-08-04) — that one's
content is folded into this one, updated for everything since.

## Website URL

**Not deployed anywhere yet.** This project only exists as a local dev server —
there is no live/public URL. Run it with:

```bash
npm install   # if starting fresh
npm run dev
```

Opens at `http://localhost:3000`. In Claude Code, ask the new session to open
the preview using the `pamhok-homes` launch config (`.claude/launch.json`).

**Known issue this session**: the dev server died unprompted a couple of times
during long work sessions (computer sleep, or just long uptime) and needed a
restart via the launch config. If a new session gets "connection refused" on
localhost:3000, that's why — just restart it, it's not a code problem.

All real credentials live in `.env.local` (gitignored, confirmed via the
`.env*` rule in `.gitignore`). **This project is not in a git repository at
all** (`git status` returns "not a git repository") — there is no version
control and no commit history. Worth setting up before this gets much bigger;
right now the only safety net is this handoff doc and Supabase's own data.

---

## What's live and working right now (verified, not assumed)

- **Core booking flow, Pesapal→removed, PayPal + M-Pesa only.** Pesapal was
  fully removed this session (see below) — final payment methods are M-Pesa
  (Paybill/STK Push) and PayPal (which also takes cards directly, no PayPal
  account needed).
- **Pay-and-verify gated unlock**, ID verification gates payment, refund
  logic on rejection (PayPal auto-refund; M-Pesa flagged for manual refund
  with a "Mark Refunded" button in the dashboard) — all still in place from
  earlier sessions, all re-verified working during this session's work.
- **Guest ID verification now has a real retry flow** (built this session):
  guest gets **up to 3 self-serve attempts** to upload a photo that passes
  Smile ID's automated check, with "you have N attempts left" messaging each
  time. Only after the 3rd failure does it escalate to the admin's
  `/admin/verifications` queue (a PDF upload or Smile ID being unreachable
  skips straight to admin review without spending an attempt, since there's
  no automated check to retry in that case). The admin card shows "(after 3
  attempts)" for context. Once escalated, the guest portal shows a **"call
  the host directly"** bar with a real `tel:` link, right after the "under
  review" banner.
- **Admin dashboard is fully built out**: Overview (stats + 4 alert cards:
  Pending ID verifications, Guest requests, Refunds needed, Renewals due
  soon), Bookings, ID Verifications, Calendar, Guest Requests, Room Settings,
  Edit Content, **Expenses** (new), Settings (change password + WhatsApp
  contact number, both with real rate limiting/verification).
- **Login is now rate-limited** — 8 wrong passwords locks that email out for
  15 minutes (server-side, real DB-backed, verified with a live simulation).
  Footer has a small "Host Login" link (was "Owner login") pointing to
  `/admin/login`.
- **WhatsApp contact is guest-facing only now, not automated alerts.**
  Twilio was removed entirely (see below) — the admin's WhatsApp number
  (Settings → WhatsApp Contact) now only powers guest-facing "Contact Host"
  buttons: Footer, Contact page, guest portal, and a new **floating WhatsApp
  button** (bottom-right, fades out after scrolling, hidden on `/admin`).
  Admin dashboard alerts are dashboard-badge-only now (no external service).
- **Homepage and About page photo slots are all admin-editable now** —
  previously several were hardcoded placeholders with no way to change them.
  Every photo field (hero, About main photo, Living Room/Bedroom/Kitchen,
  Coffee Corner/Reading Nook) has Upload/Replace/**Remove**, and the photo
  grids have a hover lift+zoom effect. Room photos (Add Room + existing
  rooms) now have the same 3-photo format **plus an editable name tag per
  photo** (was previously invisible/uneditable `photo_labels` data).
- **Business expense tracker** (`/admin/expenses`, new this session) — add
  recurring bills (name, amount, currency, billing cycle, due date, notes),
  live "Renewals due soon" dashboard card (no cron needed — computes live on
  page load), plus a dormant `/api/cron/expense-reminders` route ready for a
  future scheduler.
- **Footer social links** (new this session) — admin-managed list of
  platform icons in the footer, active/inactive toggle, reordering.
- **Real contact info is live**: phone `+254 704 393 189`, email
  `pamhokhomes@gmail.com` (both `SITE.phone`/`SITE.contactEmail` in
  `src/lib/site.ts`, and `admin_users.whatsapp_phone` — these were
  out of sync at one point this session; both are now the same real number).

## What the owner has already started using (as of this handoff)

Confirmed via direct DB query, not assumed — real data, not test data:
- **1 real room** already added: "Room One (1)" with 3 real uploaded photos
  and name tags ("LOUNGE", "KITCHEN", "BEDROOM"). Still needs a real name
  (currently literally "Room One (1)"), description, and price review.
- **2 real social links**: Instagram and TikTok, both with real URLs.
- **Homepage**: real eyebrow/headline/subtext copy and a real hero photo,
  already in place.
- **About page**: real body copy and a real main photo already in place.
  The Coffee Corner / Reading Nook photo slots are still empty/placeholder.
- **Contact page**: real intro line in place.
- Amenities section is still the original default 5 items — not yet
  customized.

---

## Everything removed/changed this session (context for why things look different)

1. **Pesapal removed entirely** — all integration code, checkout UI, env
   vars, refund branching. Final payment methods: M-Pesa + PayPal only.
2. **Twilio/automated WhatsApp alerts removed entirely** — all internal
   admin alerts (new requests, urgent ID review, refunds needed) are
   dashboard-badge-only now. The admin's WhatsApp number was repurposed
   for guest-facing "Contact Host" buttons instead (see above).
3. **Test/dummy data cleared** from `bookings`, `guests`, `reviews` (was
   13 test guests and their bookings, one fake review — all gone, real
   0/0/0 now, confirmed).
4. **Two fake sample rooms deleted** — "The Family Suite" and "The Garden
   Room" never corresponded to real rooms and were removed. This surfaced
   and fixed a real bug in the process: `getRooms()`/`getRoomBySlug()` used
   to silently fall back to fake sample data whenever the real `rooms`
   table was empty or a slug wasn't found — even when Supabase was properly
   connected. That's fixed now: an empty/not-found result shows a genuine
   empty state (or 404), never fake data. Sample-data fallback now only
   fires on an actual connection error.

---

## Known unresolved issues (carried over, still true)

1. **A genuine unexplained RLS anomaly** from early in the project (a
   fresh table with a textbook-correct insert policy still rejected `anon`
   inserts) — worked around by routing guest-facing writes through the
   service-role client, but root cause was never found. Worth a Supabase
   support ticket, independent of this project's code.
2. **Smile ID's success path is still unverified** — only the failure path
   has ever been tested (fake images correctly fail their real liveness/
   document checks; there's no way to fabricate a passing test without a
   genuine ID photo + matching selfie). Not a code concern, just an
   untested path.
3. **M-Pesa's real "Paid" outcome still needs a genuine test** — the STK
   push plumbing is proven correct end-to-end against Safaricom's sandbox
   (confirmed a real CheckoutRequestID gets issued), but no real phone has
   ever entered a PIN to complete one, so the actual success path is
   unconfirmed.

## Still to do (accurate as of this handoff)

- **Deploy somewhere and set a real domain.** `NEXT_PUBLIC_SITE_URL` is
  still `http://localhost:3000` — this isn't cosmetic, it's baked into
  PayPal/M-Pesa callback URLs, QR-code verification links, and portal
  links, so none of those will work correctly once this is actually hosted
  until it's updated. `MPESA_CALLBACK_URL` and `CRON_SECRET` are also still
  blank in `.env.local`.
- **Add real rooms** (beyond the one already started) — the improved Add
  Room form now supports 3 photos + name tags in one step. Also worth
  renaming "Room One (1)" to something real.
- **Fill in the Living Room / Bedroom / Kitchen photos** on the homepage
  and the **Coffee Corner / Reading Nook** photos on About — both sections
  are wired up and ready in Edit Content, just not filled in yet.
- **Customize the Amenities section** — still the original default copy.
- **Fix the business expense placeholders** — Domain (.store), Vercel Pro,
  and Supabase Pro were seeded with a 30-days-out placeholder date and no
  amount, since the real renewal dates/costs weren't known. Update them in
  `/admin/expenses` with real values, or the "Renewals due soon" alert will
  fire on the wrong date.
- **Get real Twilio credentials if WhatsApp automated alerts are wanted
  back** — moot for now since that whole system was intentionally removed
  this session in favor of dashboard-only alerts + guest-facing WhatsApp
  buttons. Only relevant if that decision gets revisited.
- **Legal review** — Terms & Privacy are still AI-drafted, not
  lawyer-reviewed, despite handling real ID documents and payment data.
- **Production credentials** — Smile ID and M-Pesa are both still on
  sandbox credentials.
- **Set up version control** — this project has no git repository at all
  right now: no history, no way to revert a bad change, no backup of the
  code itself beyond what's on disk. Owner wants to tackle this in the new
  chat. The plan:
  1. **Local repo first** (safe, no account needed, doesn't push anywhere):
     ```bash
     git init
     git add -A
     git commit -m "Initial commit"
     ```
  2. **Then ask the owner** whether they also want a remote backup (e.g. a
     private GitHub repo) — that's a separate step (create the repo, add
     it as a remote, push). Don't assume; confirm first, since pushing
     code anywhere is a "visible to others / affects shared state" action.
  3. Check `.gitignore` already exists and correctly excludes `.env.local`
     and other secrets before the first commit — confirm, don't assume,
     since accidentally committing real credentials would be bad. It was
     confirmed to exist and correctly cover `.env*` earlier in this
     project's life, but re-verify at commit time regardless.

---

## Reference: real admin account

Admin email: `pamhokhomes@gmail.com` — login works, password already set
by the owner (not known to any Claude session, by design — sessions can't
and shouldn't ask for it or enter it).
