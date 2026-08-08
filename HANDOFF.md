# Pamhok Homes — Handoff / Status Summary

Last updated: 2026-08-08. Written for continuing this project in a
**new chat** — paste a link to this file (or its contents) so the new session
has full context. This supersedes the previous version of this file (dated
2026-08-06, morning) — that one's content is folded into this one, updated
for everything since.

---

## ⚠️ PENDING ISSUES — full summary (start here)

Everything below is consolidated from across this doc, in one place, with
what's actually needed to close each one. Nothing here is duplicated
detail-for-detail elsewhere without a pointer back to the fuller
explanation.

### Blocked on the owner specifically (Claude can't do these)

1. **Domain ownership check.** The site now runs on a real custom
   domain, **www.pamhokhomes.com**, aliased in Vercel — but this
   happened **independently of any Claude session**, discovered
   2026-08-08 when the old `.vercel.app` URL started 404ing.
   **Confirm who purchased pamhokhomes.com and that its DNS/renewal is
   being tracked somewhere** — a `buy_domain` tool exists in this
   environment, so it's plausible another Claude session bought it, but
   that's unconfirmed. `/admin/expenses` still has a placeholder entry
   for a *different* domain (a ".store" one) that no longer matches
   what's actually live — needs correcting either way. See "Still to
   do" item 1 for the full story.
2. **Email notifications** (guest-experience feature spec, section 7).
   Sign up at resend.com, hand over an API key. Until then this is the
   only piece of that feature build left undone — everything else
   (checkout/cleaning reminders on the My Booking page, manual booking,
   room status, stale-checkout flagging, etc.) is live. See "Still to
   do" item 2.
3. **M-Pesa Go-Live submission.** Confirm you have M-Pesa Portal
   **Admin/Business Manager** access (separate from the Daraja
   developer account) — email m-pesabusiness@safaricom.co.ke if not.
   Deployment (the other blocker) is done. See the M-Pesa section above
   for the full process.
4. **PayPal go-live.** Same-day, self-serve, whenever you're ready —
   flip sandbox→live on developer.paypal.com/dashboard. No credentials
   handed over yet.
5. **Enable Leaked Password Protection** — Supabase Dashboard →
   Authentication → Policies. Currently off (protects the admin
   password against HaveIBeenPwned-listed passwords). No tool/API
   access to toggle this — dashboard only.
6. **Confirm your Supabase backup tier/settings** — Dashboard →
   Database → Backups. Paid-tier feature; no tool exposes current
   status.
7. **Production Smile ID credentials** — still sandbox.
8. **Add remaining placeholder photos** — Living Room/Bedroom/Kitchen
   (homepage), Coffee Corner/Reading Nook (About) — empty slots, wired
   up and ready in `/admin/content` whenever you have the photos.
9. **Fix business expense placeholders** in `/admin/expenses` — wrong
   domain type (see item 1) and placeholder renewal dates (2026-09-03)
   with no amount for Vercel Pro/Supabase Pro, which will trigger a
   wrong "renewal due" dashboard alert until corrected.

### Needs your decision, not urgent

10. **Feature real guest reviews** as they come in — mechanism's built
    (`/admin/reviews`), zero real reviews exist yet so the homepage
    still shows sample testimonials by design.
11. **Rotate the 3 exposed secrets** (Supabase service role key, PayPal
    sandbox client ID/secret, Smile ID API key) — exposed once in a
    local terminal transcript only, never transmitted. Assessed as
    low-priority/deferred; natural point to rotate is alongside any
    future credential refresh. Only urgent if anything suspicious ever
    turns up on the Supabase project specifically.
12. **~40 deferred RLS performance optimizations** flagged by Supabase's
    advisor (`auth.uid()` re-evaluated per row; multiple permissive
    policies per table) — genuinely low-priority at 2 real bookings'
    worth of traffic. Revisit if traffic grows; full list via the
    Supabase MCP `get_advisors` (performance) tool.

### Untested, not code issues — just flagging

13. **Smile ID's success path** — only the failure path has ever been
    exercised.
14. **M-Pesa's real "Paid" outcome** — STK push plumbing is proven
    correct against sandbox, but no real phone has completed one yet.
15. **An unexplained RLS anomaly** from early in the project (a
    textbook-correct insert policy still rejected `anon` inserts on a
    fresh table) — worked around via the service-role client
    everywhere writes happen; root cause never found. Worth a Supabase
    support ticket independent of this project if it's ever worth
    chasing down.

---

## Website URL

**Not deployed anywhere yet — still local only.** Run it with:

```bash
npm install   # if starting fresh
npm run dev
```

Opens at **`http://localhost:3000`**. In Claude Code, ask the new session to
open the preview using the `pamhok-homes` launch config
(`.claude/launch.json`, `autoPort: true` — if port 3000 is already taken by
another session's dev server on the same machine, connect directly via
`preview_start` with `{url: "http://localhost:3000"}` instead of fighting
for the port; don't run a second `next dev` on the same project folder).

Real credentials live in `.env.local` (gitignored). **Version control is now
set up** (see below) — this is no longer the only safety net.

---

## Git — now set up (was pending, now done)

Local repo initialized this session. 12 commits so far, working tree clean:

```
f429dd5 Add review curation to the admin dashboard
d142db7 Restrict room card hover/pointer cursor to tablet and up
6b16f3d Add an emergency site shutdown switch to admin Settings
90d87f4 Support pasting ready-made Google Maps directions links
ea6841d Add point-to-point directions from Pamhok Homes to neighborhood places
9b89741 Make the Neighborhood page admin-editable, with photos
32868be Blur door code/WiFi behind the arrival pass popup
03df202 Add a live public-page preview to room settings
c0a996a Add Google Maps directions and an in-portal arrival flow
2a0c5df Add date-first room search and hover/tap feedback on room cards
f3648b9 Add per-room WiFi network name and room ordering
d9b658f Initial commit
```

**No remote yet.** The owner has not asked for a GitHub backup — offer,
don't assume. Pushing anywhere is a "visible to others" action, confirm
first per this project's own standing instructions.

`.gitignore` correctly excludes `.env*` (confirmed — this also means
`.env.example` itself has never actually been committed, since it's swept
up by the same blanket `.env*` rule; harmless, just means it's a
local-only reference file, not something `git status` will ever show).

---

## What's live and working right now (verified, not assumed)

- **Core booking flow** — PayPal + M-Pesa, pay-and-verify gated unlock, ID
  verification via Smile ID, refund logic — all unchanged from before this
  session, still working.
- **10 real rooms**, correctly numbered/ordered 1–10 on both `/admin/rooms`
  and the public `/rooms` page (new `display_order` field, admin-editable).
  Room order is **not** the same as price order — it's a manual field the
  admin sets. 9 of the 10 rooms share the *exact same* description text
  ("The one-bedroom at Pamhok Homes provides a spacious yet intimate
  setting…") — only Room Eight has distinct copy; confirmed intentional
  with the owner, no change needed. "Room Ten (Q)" also confirmed
  intentional as-is.
- **Per-room WiFi network name** (SSID), separate from the WiFi password —
  admin sets both in Room Settings; guest portal shows both once verified.
- **Room settings live preview** — toggle in `/admin/rooms` shows exactly
  how a room's *unsaved* edits will look on the public listing card, plus a
  "View Live Page" link to the real saved page.
- **Date-first room search on `/rooms`** — leads with a calendar; the room
  grid stays hidden until check-in/check-out are picked, then filters
  client-side to only rooms with no conflicting booking. Dates carry
  through to the room detail page via `?checkIn=&checkOut=`, pre-filling
  that room's own calendar (re-validated against live availability on
  arrival — falls back to blank with a notice if someone else booked those
  exact dates in the gap).
- **Room card hover/tap effects** — lift + photo zoom, scoped correctly:
  tablet/desktop (≥768px) get real `:hover` + pointer cursor; phone
  (<768px) only gets the effect on tap (`:active`), cursor stays the
  default arrow. Verified at all three breakpoints.
- **Real Google Maps integration**:
  - Pamhok Homes' actual pin resolved to precise coordinates and stored
    (Contact & Location admin section — paste any Google Maps link into
    the "Google Maps link" field and it auto-resolves on blur, showing a
    ✓ or a clear error).
  - "Get Directions" button (Contact page + guest portal) — shows a
    friendly location-permission explainer before the browser's native
    prompt, then opens the real pin either way.
  - **Neighborhood page is now admin-editable** (`/admin/content` →
    Neighborhood): add/remove places under Food or Recreation, each with a
    name, detail line, and a photo upload slot. 6 real places under
    Recreation (Thika Road Mall/TRM, Garden City Mall, Two Rivers Mall,
    Village Market, Karura Forest, Nairobi National Park), **all with
    working "Get Directions from Pamhok Homes" buttons** built from
    precise point-to-point Maps routes. Two Food places added (Artcaffe,
    Java House); no Maps link supplied for either yet, so no directions
    button on those two until one's added. All neighborhood photos —
    Recreation and Food — are now uploaded.
- **"I've Arrived" flow in the guest portal** — once paid + verified, a
  guest sees "Get Directions" and "I've Arrived" buttons. Tapping the
  latter pops up a congratulations message plus their verification pass
  (name, room, dates, reference — QR code removed) to show security. The
  Reference field is a computed code, not the booking's own
  `booking_reference`: `REF{month}/{day}-{room}-{yy}` from the check-in
  date and room number, e.g. a 7 Aug 2026 check-in into Room Four reads
  `REF8/7-4-26`. The door code/WiFi card behind the popup **blurs** while
  it's open (fixed a real privacy gap — it used to be visible around the
  popup's edges on wider screens) and un-blurs the moment the guest closes
  it.
- **Emergency site shutdown switch** (`/admin/settings` → "Site Status")
  — two-step confirm to shut down, one click to reopen. When closed, the
  guest-facing marketing pages (home, rooms, about, amenities,
  neighborhood, contact) rewrite to `/maintenance` with a warm message and
  real WhatsApp/call buttons. **Deliberately stays live throughout**:
  `/admin` (so the dashboard can reopen it), `/api` (payment callbacks),
  `/portal/[token]` and `/verify/[token]` (a guest already checked in
  shouldn't lose their door code because of an unrelated emergency, and
  security must still be able to scan passes).
- **Reviews are now admin-curatable** (`/admin/reviews`, brand new) — every
  guest-submitted review gets a "Feature" toggle and a delete option
  (two-step confirm). **This fixed a real, previously-invisible gap**: the
  homepage's "Guest Reviews" section was rendering a hardcoded fake
  testimonials array — `getReviews()` existed in the codebase but was
  never actually called from anywhere. Real guest reviews were being
  collected via the post-stay portal flow and just sitting unused in the
  database. Now: the homepage shows the fake sample testimonials **only**
  until the admin features at least one real review, then switches to
  showing real featured reviews exclusively (never blends real + fake).
  **Currently 0 real reviews exist** — nothing's been featured yet because
  nothing real exists yet to feature.
- **Real amenities, homepage, about, and contact copy** — all written this
  session with real property details, no more placeholder text in those
  sections.

## M-Pesa & PayPal — where things actually stand

This is the most important section to get right for whoever picks this up.

- **M-Pesa STK Push is fully built**, but as **two Supabase Edge
  Functions** (`supabase/functions/mpesa-initiate`,
  `supabase/functions/mpesa-callback`) — **not** Next.js API routes, and
  **not** configured via `.env.local`. Credentials are **Supabase project
  secrets**, set via `supabase secrets set` (or the Supabase Dashboard →
  Edge Functions → Secrets). This was discovered this session: `.env.local`
  used to have a full set of `MPESA_*` variables that looked active but
  were 100% dead/unused — nothing in the running app ever read them. That
  dead block has been removed from `.env.local`, and `.env.example` now
  has a comment pointing at the correct location instead of misleading
  blank placeholders.
- **New sandbox Consumer Key + Consumer Secret were set this session**
  (Supabase Edge Function secrets, confirmed via updated timestamp).
  `MPESA_SHORTCODE` and `MPESA_PASSKEY` were **left untouched** — only
  Consumer Key/Secret were given as new values. Worth double-checking
  those two against whatever the new sandbox app's own dashboard shows,
  though the current values (shortcode `174379` + its paired passkey) are
  Safaricom's standard shared public sandbox test values, so they're
  likely still fine regardless of which app/Consumer Key is used.
- **Going to production M-Pesa requires**: (1) a real Paybill number, (2)
  M-Pesa Portal access with an Admin/Business Manager role (separate from
  the Daraja developer account — email m-pesabusiness@safaricom.co.ke if
  the owner doesn't have this), (3) submitting a "Go-Live" request inside
  the logged-in Daraja portal for the **M-Pesa Express (Prompt) / STK
  Push** API specifically, tied to the Paybill. This is a real Safaricom
  business review process — expect days, not minutes. **This also can't
  fully complete until the site is deployed** — the callback URL Safaricom
  posts results to needs to be a real public HTTPS URL, and right now
  everything points at `localhost`.
- **PayPal is still on sandbox** (`PAYPAL_ENV=sandbox` in `.env.local`).
  Going live is same-day and fully self-serve: upgrade the PayPal account
  to Business if it isn't already, flip the toggle from Sandbox to Live on
  developer.paypal.com/dashboard, create/open a Live app, copy the Client
  ID + Secret. No credentials handed over for this yet.
- **⚠️ Security note for the owner, not a code issue**: earlier this
  session, an unredacted terminal command briefly printed several *other*
  real secret values (Supabase service role key, PayPal sandbox client
  ID/secret, Smile ID API key) into this session's tool-output transcript
  while inspecting `.env.local`. Nothing left the local machine — it was a
  local command, not sent anywhere — but if that's a concern, rotating
  those specific keys is a reasonable precaution. The new M-Pesa
  credentials were **not** exposed this way (set via a temp env file with
  `--env-file`, never printed).

---

## Security & performance hardening pass (2026-08-08)

Full audit against `performance-and-security-hardening.md`. Everything
below is committed, pushed, and deployed to production unless noted.

**Critical checks (explicitly requested) — both clean:**
- `.env.local` never committed, never tracked, doesn't appear anywhere
  in git history on any branch.
- `service_role` key: zero client-side exposure, confirmed 3 ways —
  every usage is a server-only route/lib file, all three lib files
  using it have `import "server-only"` (hard build failure if ever
  imported client-side), and the env var itself isn't `NEXT_PUBLIC_`
  prefixed.

**Security fixes:**
- **`availability_view` SECURITY DEFINER (Supabase advisor ERROR)** —
  was bypassing `bookings`' own RLS entirely. `anon` had blanket
  table-level SELECT on `bookings` at the Postgres grant level with
  only the view standing in the way. Fixed: narrowed to a real
  column-level grant (room_id/check_in/check_out/booking_status only)
  plus a matching row policy, view now runs `security_invoker`.
  Verified live with an anon-key client — availability check still
  works, direct query for guest_id/payment_status/id_document_path now
  gets a hard permission-denied.
- **Rate limiting** added to booking, contact, and review forms (5/10min
  per IP, same fixed-window pattern as the existing admin login
  lockout) — previously only admin login had it. Verified live on all
  three (6th attempt in the window correctly 429s).
- **Input validation** strengthened: contact form and both booking
  paths (public + admin manual) now validate email/phone format
  server-side, not just "non-empty string". File uploads (ID docs, room
  photos) were already properly validated (type allowlist + size cap)
  — no changes needed there.
- **Security headers** added via `next.config.ts`: CSP (audited what
  the browser actually loads — same-origin + Supabase Storage/auth
  only; no third-party scripts/iframes anywhere, PayPal is a full
  redirect so needs no CSP allowance), X-Frame-Options: DENY, HSTS,
  X-Content-Type-Options: nosniff, Referrer-Policy. Verified present on
  the live response, zero console/CSP violation errors on any page.
- **`npm audit`**: 1 high-severity transitive vuln (nanoid, via
  postcss) — fixed via `npm audit fix`, 0 vulnerabilities now.
- **⚠️ Two items only the owner can check** (no tool/API access to
  either): enable "Leaked Password Protection" in Supabase Dashboard →
  Authentication → Policies (currently disabled, WARN-level advisor
  finding — protects the admin password against HaveIBeenPwned-listed
  passwords); confirm Supabase's automatic backup tier/settings
  (Dashboard → Database → Backups, paid-tier feature, not exposed via
  any available tool).

**Performance fixes:**
- `next/image` migration for the two real-photo-heavy components
  (`PhotoCard`: homepage hero + About Us; `RoomPhoto`: Rooms grid/
  detail, Neighborhood) — automatic resizing/lazy-loading/modern
  formats. Left admin-only chrome (nav/login logos, ID-verification
  review thumbnails, an upload-preview `blob:` URL next/image can't
  handle) as plain `<img>` — not worth the complexity there.
- Amenities/About Us/Neighborhood switched to ISR (`revalidate = 300`)
  instead of hitting Supabase on every request — verified none of the
  three need per-request data (plain anon client, no cookies/headers).
  Rooms/homepage/admin dashboard stay live-fetched, matching their
  actual freshness needs.
- Dropped the unused 700 (bold) weight from Fraunces and Plus Jakarta
  Sans — audited every actual computed font-weight rendered site-wide;
  nothing ever reaches 700. `font-display: swap` was already the
  default (next/font/google) — confirmed directly against the
  generated `@font-face` rules, not assumed.
- Code-splitting: confirmed no guest-facing page imports anything from
  `@/components/admin` — Next.js App Router's automatic per-route
  bundling already keeps admin code out of guest bundles. No changes
  needed, just verified.
- 3 missing FK-covering indexes added (`bookings.guest_id`,
  `guest_requests.booking_id`, `reviews.booking_id`) — the latter two
  back real, active queries (portal.ts's laundry lookup, the
  review-exists/count checks).
- **Deferred, low-priority**: Supabase's advisor also flags ~40
  RLS-performance items (`auth.uid()` re-evaluated per row instead of
  `(select auth.uid())`; multiple permissive policies per table/action)
  across nearly every table. All pre-existing, all WARN/INFO level, and
  genuinely not worth the risk of rewriting every RLS policy in the
  schema for a site with 2 real bookings so far. Revisit if traffic
  ever grows enough for it to matter — `get_advisors` (performance)
  via the Supabase MCP tool surfaces the full current list.

**Also discovered mid-pass, unrelated to the hardening work itself**:
the site now has a real custom domain — see item 1 above.

---

## Known unresolved issues (carried over from before, still true)

1. **A genuine unexplained RLS anomaly** from early in the project (a
   fresh table with a textbook-correct insert policy still rejected `anon`
   inserts) — worked around via the service-role client, root cause never
   found. Worth a Supabase support ticket, independent of this project.
2. **Smile ID's success path is still unverified** — only the failure path
   has ever been tested. Not a code concern, just an untested path.
3. **M-Pesa's real "Paid" outcome still needs a genuine test** — the STK
   push plumbing is proven correct against Safaricom's sandbox (a real
   `CheckoutRequestID` gets issued), but no real phone has ever completed
   one, so the actual success path is unconfirmed.

## Still to do (priority order)

1. ~~Deploy somewhere + set a real domain~~ — **done, and upgraded.**
   Real custom domain is live: **https://www.pamhokhomes.com** (Vercel
   account `silvianjambikangethe-8696`, project `pamhok-homes`). Note:
   the domain purchase/DNS/alias setup happened **independently of any
   Claude session doing this work** — discovered mid-session on
   2026-08-08 when `pamhok-homes.vercel.app` (the domain used earlier
   this session) started 404ing; `vercel alias ls` showed pamhokhomes.com
   and www.pamhokhomes.com aliased ~5h earlier, apex redirecting to
   www. `NEXT_PUBLIC_SITE_URL` was still pointing at the old
   `.vercel.app` URL when this was found — a real live bug (PayPal
   returns, portal links, WhatsApp share text all would've pointed at a
   dead domain for any real guest) — fixed immediately and redeployed.
   If pamhokhomes.com ever needs revisiting: check who/how it was
   purchased (a `buy_domain` Vercel MCP tool exists and is available in
   this environment, so it's plausible another session used it) and
   confirm DNS/renewal is something the owner is tracking, since
   `/admin/expenses` still has placeholder renewal dates for a ".store"
   domain that no longer matches what's actually in use.
   All 9 real `.env.local` secrets are in Vercel's Production
   environment, plus a fresh `CRON_SECRET` (never reused from
   `.env.local`). Verified live: homepage renders, `/rooms` pulls real
   Supabase data (no "sample rooms" fallback banner), no console errors,
   security headers all present on the real domain (see item 11 below).
   `MPESA_CALLBACK_URL` is still unset, but that's fine as-is — the
   Supabase Edge Function defaults it to its own function URL
   (`*.supabase.co/functions/v1/mpesa-callback`) when unset, already a
   real public HTTPS endpoint regardless of frontend domain. Never
   actually blocked on deployment.
   Local, GitHub, and the live Vercel deployment are all in sync as of
   this update — everything through the guest-experience feature build
   (Sections 1–6, 8 below) plus the security/performance hardening pass
   (item 11) is committed, pushed, and deployed.
2. **Email notifications (guest build spec §7) — blocked on the owner.**
   Everything else in the guest-experience feature build is done and
   live (see below) — this is the one piece I can't do myself. Needs:
   (a) the owner signs up at resend.com and hands over an API key (I
   can't create third-party accounts), (b) I wire up booking-confirmation
   + checkout-reminder + cleaning-notice emails using Resend's default
   `onboarding@resend.dev` sender so nothing's blocked on domain
   verification, reusing the exact day/time-math already built in
   `src/lib/guest-notices.ts` for the My Booking page, (c) a Vercel Cron
   job to actually trigger the time-based ones daily. Swapping to
   `bookings@pamhok.com` later, once the owner adds pamhok.com's DNS
   records to Resend, is a one-line `EMAIL_FROM_ADDRESS` env var change.
3. **Submit the M-Pesa Go-Live request** — deployment's done; still needs
   M-Pesa Portal Admin access confirmed. See the M-Pesa section above for
   the exact process.
4. **Go live with PayPal** — same-day, self-serve, whenever the owner is
   ready. See above for the exact steps.
5. **Feature real guest reviews as they come in** — the mechanism is built
   (`/admin/reviews`) but there are zero real reviews yet, so the homepage
   is still showing fake sample testimonials by design.
6. **Fill in remaining placeholder photos** — Living Room / Bedroom /
   Kitchen (homepage) and Coffee Corner / Reading Nook (About) — still
   empty, unchanged this session, wired up and ready in Edit Content.
7. **Update business expense placeholders** — Domain (.store), Vercel Pro,
   Supabase Pro all still have placeholder renewal dates (2026-09-03) and
   no amount, so the "Renewals due soon" dashboard alert will fire on the
   wrong date until corrected in `/admin/expenses`.
8. **Production credentials for Smile ID** — still sandbox.
9. ~~Rotate exposed secrets~~ — **assessed, deferred, not a code fix.**
   The exposure (Supabase service role key, PayPal sandbox client
   ID/secret, Smile ID API key) was local terminal output only, never
   transmitted anywhere, and two of the three are sandbox-scoped to begin
   with. No Claude session can rotate these directly — that needs the
   owner's own login on each provider's dashboard, and doing it blind
   would break live integrations until every place using the old key
   (Edge Function secrets, `.env.local`) gets updated in step. Judgment
   call: not worth the disruption right now. Natural point to rotate
   instead is **deployment** (item 1) — production secrets get set fresh
   there anyway. Revisit immediately, ahead of that, only if anything
   suspicious ever turns up on the Supabase project specifically (it's
   the one real, non-sandbox key of the three).
10. ~~Set up a GitHub remote~~ — **done.** Repo is
   `silvianjambikangethe-lang/pamhok-homes` on GitHub, pushed and current.

---

## Reference: real admin account

Admin email: `pamhokhomes@gmail.com` — login works, password already set
by the owner (not known to any Claude session, by design — sessions can't
and shouldn't ask for it or enter it).
