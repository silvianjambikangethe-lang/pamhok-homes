# Pamhok Homes — Handoff / Status Summary

Last updated: 2026-08-12. Written for continuing this project in a
**new chat** — paste a link to this file (or its contents) so the new session
has full context. This supersedes the previous version of this file (dated
2026-08-08) — that one's content is folded into this one, updated for
everything since. See "Session update (2026-08-12)" below for what's new.

---

## Session update (2026-08-12)

Fresh clone of the GitHub repo onto a new machine, brought back to a
working local state, plus a new admin-login security feature. In order:

1. **Cloned + installed.** `git clone`, `npm install` — clean, 0
   vulnerabilities.
2. **Fixed a real bug found on first run**, not just a config issue:
   `getAdminContactPhone()` in `src/lib/data.ts` is called unconditionally
   from `RootLayout`, and its own comment says it should degrade to `null`
   until fully configured — but its guard only checked
   `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, not
   `SUPABASE_SERVICE_ROLE_KEY`, which the admin client it calls actually
   needs. Result: every page crashed with "Supabase admin client requires
   ..." whenever the service-role key wasn't set yet, instead of just
   hiding the WhatsApp button. Fixed by adding the missing check to that
   one guard.
3. **`.env.local` recreated** (gitignored, wasn't in the clone) — public
   Supabase URL/anon key pulled via the Supabase MCP tools; PayPal/Smile
   ID/cron secrets left blank (not required to browse the site).
   `SUPABASE_SERVICE_ROLE_KEY` was later supplied directly by the owner in
   chat and added — needed for `src/lib/supabase/admin.ts`, used by admin
   routes, the login-attempt lockout table, and the recovery flow below.
4. **Confirmed no drift**: the Supabase project's 5 migrations match
   `supabase/migrations/` exactly. No Vercel project exists under the
   connected account (`silvianjambikangethe-8696's projects`, zero
   projects) — see the flag under "Website URL" below, this contradicts
   an earlier note in this doc about a live custom domain.
5. **New feature: admin login lockout dropped from 8 to 3 attempts, plus
   a self-service email-based unlock/password-reset flow.** Full detail
   in the new "Admin login: 3-attempt lockout + email recovery
   (2026-08-12)" section below. Built, typechecked (`tsc --noEmit` clean),
   linted (no new errors — the 4 pre-existing lint errors in
   `CurrencySelector.tsx`/`ThemeToggle.tsx`/`AdminTextSizeContext.tsx`/
   `tailwind.config.ts` are unrelated), and verified live in the browser:
   logged in successfully with the reset credentials, landed on a
   populated `/admin` dashboard.
6. **Admin password was reset** at the owner's explicit request and
   direction (they specified the new password) — done via direct SQL
   against `auth.users` (using pgcrypto's `crypt()`/`gen_salt('bf')`,
   since the service-role key wasn't available yet at that point in the
   session), not through the app's own admin-update-user API. The
   previous version of this doc deliberately kept the password unknown to
   any Claude session "by design" — that principle was intentionally
   broken this one time because the owner asked directly and supplied the
   exact value. **The new password is not recorded anywhere in this repo,
   in Claude's memory system, or in this file** — same as before, only
   the owner knows it. If it needs to change again, prefer the new
   `/admin/recover` flow (owner-driven, via the registered admin email)
   over asking a Claude session to set it directly.
7. **Smile ID removed entirely, at the owner's explicit request** (they're
   sourcing a different ID-verification provider). Removed from local
   code, Supabase, and `.env.local`; nothing to remove on Vercel since no
   Vercel project currently exists (see item 1 below). Specifically:
   `src/lib/smileid.ts` and its zip-only-used-by-it helper
   `src/lib/zip.ts` deleted; the `upload-id` route no longer calls any
   verification API and every guest ID upload now goes straight to
   `/admin/verifications` for manual Approve/Reject; the `bookings`
   column `smile_id_result` was renamed to `id_verification_result`
   (provider-agnostic jsonb, currently unused — migration
   `20260812141432_rename_smile_id_result_to_id_verification_result`,
   applied to both the live Supabase project and
   `supabase/migrations/`); `SmileIdResult` type renamed to
   `IdVerificationResult`; `SMILE_ID_*` vars dropped from `.env.local`;
   README/privacy-policy copy updated to stop naming Smile ID. **The
   option is deliberately kept, not deleted**: `id_verification_method`
   (`'automatic' | 'manual_override'`), `id_verification_attempts`, and
   `id_verification_result` all still exist on `bookings` specifically so
   a future provider can be wired into the same upload route the same
   way Smile ID was, without a new migration. Zero real bookings existed
   at removal time, so no historical verification data was lost. This
   also fully retires pending items that used to reference Smile ID
   specifically (production credentials, untested success path, the
   exposed sandbox API key) — see the updated pending-issues list below.
8. **M-Pesa swapped from Safaricom Daraja to Equity's Jenga API**, at the
   owner's explicit request — they're settling into a real Equity account
   (account-based settlement) and pasted sandbox `JENGA_CONSUMER_KEY`/
   `JENGA_CONSUMER_SECRET`/`JENGA_ENV`/`JENGA_ACCOUNT_NUMBER` directly in
   chat. `supabase/functions/mpesa-initiate` and `mpesa-callback` were
   rewritten in place (same function names, so `PaymentSection.tsx` didn't
   need to change) plus a new `supabase/functions/_shared/jenga.ts` RSA
   request-signing helper. **This is genuinely unconfirmed, not just
   pending deployment** — full detail in the "M-Pesa & PayPal" section
   below, but in short: Jenga's STK push requires an RSA key pair (private
   key signs requests, public key gets uploaded to the Jenga dashboard)
   that doesn't exist yet, and Jenga's own docs were inconsistent enough
   across pages that the OAuth credential mapping is a documented best
   guess, not a confirmed fact. I also don't currently have Supabase
   deploy/secrets tool access this session (MCP disconnected, no local
   CLI), so none of this is live yet regardless.

---

## ⚠️ PENDING ISSUES — full summary (start here)

Everything below is consolidated from across this doc, in one place, with
what's actually needed to close each one. Nothing here is duplicated
detail-for-detail elsewhere without a pointer back to the fuller
explanation.

### Blocked on the owner specifically (Claude can't do these)

1. **Domain ownership check — now actively contradicted, needs the
   owner's eyes.** This doc has claimed since 2026-08-08 that the site
   runs on a real custom domain, **www.pamhokhomes.com**, aliased in
   Vercel. On 2026-08-12, checking the Vercel MCP connection (account
   `silvianjambikangethe-8696's projects`) turned up **zero Vercel
   projects** — no `pamhok-homes` project, nothing. Either (a) the
   deployment exists under a different Vercel account/team than the one
   currently connected, (b) it was deleted since 2026-08-08, or (c) the
   original claim was never accurate (this doc itself flagged it as
   "unconfirmed" and "independent of any Claude session" when first
   written). **Owner: please confirm whether www.pamhokhomes.com is
   actually live**, and if so, under which Vercel account. Until
   confirmed, treat "Website URL" below (local-only) as the current
   known-true state. `/admin/expenses` still has a placeholder entry for
   a *different* domain (a ".store" one) that doesn't match either
   story — needs correcting either way. See "Still to do" item 1 for the
   fuller original story.
2. **Email notifications** (guest-experience feature spec, section 7).
   Sign up at resend.com, hand over an API key. Until then this is the
   only piece of that feature build left undone — everything else
   (checkout/cleaning reminders on the My Booking page, manual booking,
   room status, stale-checkout flagging, etc.) is live. See "Still to
   do" item 2.
3. **M-Pesa is unconfirmed and needs real sandbox testing before
   go-live.** M-Pesa now runs via Equity's Jenga API (swapped in for the
   old Daraja integration at your request) — but it's untested against a
   live sandbox call and needs an RSA key pair you haven't generated yet.
   See the M-Pesa section above for exactly what's missing. Once that's
   confirmed working in sandbox, going to production will need Jenga's
   own go-live process (contact Equity/Finserve — not yet researched).
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
7. **Add remaining placeholder photos** — Living Room/Bedroom/Kitchen
   (homepage), Coffee Corner/Reading Nook (About) — empty slots, wired
   up and ready in `/admin/content` whenever you have the photos.
8. **Fix business expense placeholders** in `/admin/expenses` — wrong
   domain type (see item 1) and placeholder renewal dates (2026-09-03)
   with no amount for Vercel Pro/Supabase Pro, which will trigger a
   wrong "renewal due" dashboard alert until corrected.
9. **Pick and wire up a new ID-verification provider** (or decide to stay
   fully manual) — Smile ID was removed at your request (see the
   2026-08-12 session update above); `/admin/verifications` manual
   Approve/Reject works fine on its own in the meantime, and the schema
   is ready for a new provider whenever you choose one (see that section
   for exactly which fields to populate).

### Needs your decision, not urgent

10. **Feature real guest reviews** as they come in — mechanism's built
    (`/admin/reviews`), zero real reviews exist yet so the homepage
    still shows sample testimonials by design.
11. **Rotate the 2 exposed secrets** (Supabase service role key, PayPal
    sandbox client ID/secret) — exposed once in a local terminal
    transcript only, never transmitted. Assessed as low-priority/
    deferred; natural point to rotate is alongside any future credential
    refresh. Only urgent if anything suspicious ever turns up on the
    Supabase project specifically. (A third exposed secret, the Smile ID
    API key, is now moot — that integration was removed entirely.)
12. **~40 deferred RLS performance optimizations** flagged by Supabase's
    advisor (`auth.uid()` re-evaluated per row; multiple permissive
    policies per table) — genuinely low-priority at 2 real bookings'
    worth of traffic. Revisit if traffic grows; full list via the
    Supabase MCP `get_advisors` (performance) tool.

### Untested, not code issues — just flagging

13. **M-Pesa's real "Paid" outcome** — now via Jenga, not Daraja, and
    unlike the Daraja plumbing it replaced, this hasn't been proven
    correct against a sandbox call at all yet (missing RSA key, unverified
    credential mapping — see the M-Pesa section above).
14. **An unexplained RLS anomaly** from early in the project (a
    textbook-correct insert policy still rejected `anon` inserts on a
    fresh table) — worked around via the service-role client
    everywhere writes happen; root cause never found. Worth a Supabase
    support ticket independent of this project if it's ever worth
    chasing down.

---

## Website URL

**Confirmed local-only as of 2026-08-12** (see pending-issues item 1 above
for why this contradicts an earlier claim in this doc about a live
www.pamhokhomes.com on Vercel — that needs the owner to resolve, not
assumed either way). Run it with:

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

- **Core booking flow** — PayPal + M-Pesa, pay-and-verify gated unlock,
  refund logic — all unchanged from before this session, still working.
  ID verification is now fully manual (Smile ID removed 2026-08-12, see
  the session update above) — every uploaded ID lands on
  `/admin/verifications` for Approve/Reject.
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

- **M-Pesa now runs on Equity's Jenga API, not Safaricom Daraja** — swapped
  out entirely at the owner's request (settling into an Equity account
  directly, account-based settlement, no separate payout step). Still two
  **Supabase Edge Functions** (`supabase/functions/mpesa-initiate`,
  `supabase/functions/mpesa-callback`) — **not** Next.js API routes, and
  **not** configured via `.env.local`. Credentials are **Supabase project
  secrets** (`JENGA_CONSUMER_KEY`, `JENGA_CONSUMER_SECRET`,
  `JENGA_ACCOUNT_NUMBER`, `JENGA_ENV`, `JENGA_PRIVATE_KEY`), set via
  `supabase secrets set` — same pattern the old Daraja `MPESA_*` secrets
  used. The old Daraja secrets (`MPESA_CONSUMER_KEY` etc.) are now unused
  and can be removed from Supabase whenever convenient — not urgent, just
  dead weight.
- **⚠️ Unconfirmed against a live sandbox call, unlike the Daraja
  integration it replaces** (which was verified against Safaricom's real
  sandbox before being trusted). The owner supplied
  `JENGA_CONSUMER_KEY`/`JENGA_CONSUMER_SECRET`/`JENGA_ENV`/
  `JENGA_ACCOUNT_NUMBER` in chat, but Jenga's own documentation is
  genuinely inconsistent across pages for this API generation, and two
  things remain unverified — see the full caveats at the top of
  `supabase/functions/mpesa-initiate/index.ts`:
  - **An RSA key pair is required and doesn't exist yet.** Jenga signs
    STK-push requests with a private key whose matching public key must be
    uploaded to the Jenga/Equity developer dashboard — this is separate
    from the Consumer Key/Secret and wasn't supplied. Nothing will work
    until one is generated (commands are in the file) and set as the
    `JENGA_PRIVATE_KEY` secret.
  - **The credential-to-field mapping for the OAuth token call is a
    best-effort guess** (`JENGA_ACCOUNT_NUMBER` → `merchantCode`,
    `JENGA_CONSUMER_KEY` → the `Api-Key` header) — Jenga's docs describe
    three separate values for this step and it's unclear the four values
    given map cleanly. Test in sandbox and adjust if the auth call fails.
  - I do not currently have Supabase deploy/secrets tool access in this
    session (the MCP connection dropped) and there's no Supabase CLI
    installed locally, so **none of this has actually been deployed** —
    it's written and ready, not live. Deploy commands are in the file.
- **Going to production M-Pesa** will need Jenga's own go-live process
  (contact Equity/Finserve — this hasn't been researched yet, unlike the
  Daraja go-live process this replaces) plus a real public HTTPS callback
  URL once the site is deployed (see the Vercel/domain item in Pending
  Issues) — right now everything points at `localhost`.
- **PayPal is still not set up** — `.env.local` confirms `PAYPAL_CLIENT_ID`
  and `PAYPAL_CLIENT_SECRET` are both empty (`PAYPAL_ENV=sandbox` is set,
  but that alone doesn't enable anything). No credentials handed over yet.
  Going live once they are: same-day, self-serve — upgrade the PayPal
  account to Business if it isn't already, flip Sandbox→Live on
  developer.paypal.com/dashboard, create/open a Live app, copy the Client
  ID + Secret. **Worth checking first**: some reports as of mid-2026
  suggest PayPal doesn't currently offer business accounts in Kenya (only
  personal) — confirm directly on PayPal's own site before relying on the
  Business-account upgrade step above.
- **⚠️ Security note for the owner, not a code issue**: a prior session's
  unredacted terminal command briefly printed several real secret values
  (Supabase service role key, PayPal sandbox client ID/secret) into that
  session's tool-output transcript while inspecting `.env.local`. Nothing
  left the local machine. If that's a concern, rotating those specific
  keys is a reasonable precaution. Separately, this session's chat now
  contains the Jenga sandbox Consumer Key/Secret and the Equity account
  number the owner pasted directly — sandbox-scoped, but worth being aware
  it's sitting in this conversation's history.

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

## Admin login: 3-attempt lockout + email recovery (2026-08-12)

Owner asked for the login lockout to trigger after 3 failed attempts
(down from the existing 8-attempt/15-minute lockout), with a way to
unlock via confirmation from the registered admin email
(`pamhokhomes@gmail.com`), then set a new password with no old-password
check. Chose Supabase's built-in password-recovery **email link** over a
typed 6-digit code — the latter would need either editing Supabase's
email templates (dashboard-only, no MCP tool for it) or wiring up a
third-party mailer (Resend isn't configured — see pending item 2). Owner
picked the link option explicitly when asked.

**Files changed:**
- `src/app/api/admin/login/route.ts` — `MAX_ATTEMPTS` 8 → 3; both 429
  responses now include a `locked: true` flag; message mentions the
  email-reset option. The existing 15-minute timer lockout is untouched
  and still applies — the email flow is a faster alternative, not a
  replacement.
- `src/app/api/admin/recover/request/route.ts` (new) — takes an email,
  only actually sends Supabase's reset-password email if it matches
  `admin_users` (checked via the service-role client), otherwise still
  returns the same generic "if that email is registered..." message
  either way (no account enumeration). Rate-limited 5/hour per IP via
  the existing `checkRateLimit` helper.
- `src/app/api/admin/recover/callback/route.ts` (new) — where the
  emailed link lands; exchanges Supabase's one-time PKCE `code` for a
  real session via `exchangeCodeForSession`. Redirects to
  `/admin/recover?error=invalid-or-expired` on failure.
- `src/app/api/admin/recover/set-password/route.ts` (new) — sets the new
  password with **no current-password check** (the session from the
  emailed link IS the identity proof), clears the `login_attempts` row
  for that email, best-effort signs out other sessions. Mirrors
  `api/admin/settings/password/route.ts`'s pattern minus the
  current-password verification step.
- `src/app/admin/recover/page.tsx` (new) — email-entry form, styled to
  match `/admin/login`.
- `src/app/admin/recover/set-password/page.tsx` (new, server component)
  — gated by the existing `requireAdmin()` (same admin_users-membership
  check every dashboard page uses; a session only exists here because of
  the callback exchange above).
- `src/components/admin/RecoverSetPasswordForm.tsx` (new) — the actual
  new-password form, posts to `set-password` above.
- `src/app/admin/login/page.tsx` — added a "Forgot password?" link
  (becomes a prominent "Locked out? Reset your password via email" CTA
  when the login response comes back `locked: true`).

**Known limitation**: Supabase's PKCE flow ties the reset link to the
browser that requested it (via a code-verifier cookie) — if the owner
requests the reset from one browser but opens the email in a different
browser/device, the link will show "invalid or expired" and they'll need
to request a fresh one from that same browser. Standard tradeoff for
`@supabase/ssr`-based apps; not worth working around for a single-admin
site.

**Verified working end-to-end in the browser** (2026-08-12, after the
owner supplied `SUPABASE_SERVICE_ROLE_KEY`): logged in successfully with
the reset password, reached a populated `/admin` dashboard. The
lockout → email → reset cycle itself (3 wrong passwords, actually
receiving and clicking the email) was **not** exercised this session —
worth a real run-through next time someone's in the admin area.

---

## Known unresolved issues (carried over from before, still true)

1. **A genuine unexplained RLS anomaly** from early in the project (a
   fresh table with a textbook-correct insert policy still rejected `anon`
   inserts) — worked around via the service-role client, root cause never
   found. Worth a Supabase support ticket, independent of this project.
2. **M-Pesa's real "Paid" outcome still needs a genuine test** — now via
   Jenga, not Daraja. Unlike the Daraja plumbing this replaced (which was
   proven correct against Safaricom's sandbox), this hasn't even had a
   successful sandbox call yet — it's missing an RSA key pair and has an
   unverified credential mapping. See the M-Pesa section above.

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
   `JENGA_CALLBACK_URL` is still unset, but that's fine as-is — the
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
3. **Get M-Pesa (via Jenga) working in sandbox, then go live** — the
   Daraja go-live process this used to need no longer applies. Currently
   blocked on generating an RSA key pair and confirming the credential
   mapping — see the M-Pesa section above for exactly what's missing.
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
8. ~~Rotate exposed secrets~~ — **assessed, deferred, not a code fix.**
   The exposure (Supabase service role key, PayPal sandbox client
   ID/secret — the third exposed secret, the Smile ID API key, is now
   moot since that integration was removed entirely on 2026-08-12) was
   local terminal output only, never transmitted anywhere, and both
   remaining ones are either sandbox-scoped or low-risk to begin with.
   No Claude session can rotate these directly — that needs the
   owner's own login on each provider's dashboard, and doing it blind
   would break live integrations until every place using the old key
   (Edge Function secrets, `.env.local`) gets updated in step. Judgment
   call: not worth the disruption right now. Natural point to rotate
   instead is **deployment** (item 1) — production secrets get set fresh
   there anyway. Revisit immediately, ahead of that, only if anything
   suspicious ever turns up on the Supabase project specifically (it's
   the one real, non-sandbox key of the two).
9. ~~Set up a GitHub remote~~ — **done.** Repo is
   `silvianjambikangethe-lang/pamhok-homes` on GitHub, pushed and current.
10. **Resolve the Vercel/domain contradiction** — see pending-issues
    item 1. Needs the owner to confirm whether www.pamhokhomes.com is
    actually live and under which account.
11. **Exercise the new lockout → email-recovery cycle for real** — fail
    login 3 times, confirm the reset email actually lands in
    pamhokhomes@gmail.com, click through, confirm the new password
    works. Only the "already logged in with a working password" half was
    verified on 2026-08-12, not the failure/recovery path itself.
12. **Pick and wire up a new ID-verification provider** (or stay fully
    manual) — Smile ID was removed entirely at the owner's request; see
    the 2026-08-12 session update for exactly which fields are ready for
    a new provider.

---

## Reference: real admin account

Admin email: `pamhokhomes@gmail.com` — login verified working as of
2026-08-12. Password was reset that session at the owner's explicit
request (they supplied the exact value; not known to this doc, this
repo, or any Claude session's memory, by design). If it needs to change
again, prefer the owner using the `/admin/recover` flow themselves (see
above) over telling a Claude session the new value directly — that's a
one-time exception, not the intended pattern going forward. Login is
now locked out after **3** failed attempts (was 8).
