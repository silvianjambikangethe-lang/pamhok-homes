# Pamhok Homes — Handoff / Status Summary

Last updated: 2026-09-24. Paste this file into a new chat to continue
with full context. This is a **condensed rewrite** — full session-by-
session history before this date lives in git (`git log HANDOFF.md`,
or `git show <commit>:HANDOFF.md` for any prior version) if you ever
need the blow-by-blow of how something was built or debugged. This
version keeps only what's needed to know current state and pick up
open work.

**Live site**: https://www.pamhokhomes.com — Vercel account
`silvianjambikangethe-8696's projects`, project `pamhok-homes`
(`prj_V4kgqkjvM3TQpo6McnsQRjmEyTtA`). Git-connected: merging to
`master` auto-deploys. Supabase project `ajxijucojqkxszfkepqr`
("PAMHOK HOMES"), org on the **Pro** plan. GitHub:
`silvianjambikangethe-lang/pamhok-homes`, public, only `master` exists.

## Currently open / blocked

- **PayPal is gone, fully removed 2026-09-22** (was previously disabled
  via a kill switch after PayPal restricted the merchant account — that
  whole code path, `lib/paypal.ts`, `payment-flags.ts`, and all PayPal
  routes/UI are deleted, not just switched off). Guests now choose
  **M-Pesa or card** only. Don't re-add PayPal without the owner asking.
- **Old sandbox findings, superseded:** the sandbox merchant also lacked
  the raw STK/USSD Push product (401101) — same root cause as the live
  "Not Authorized"; both merchants are PGW-only. Known gap that remains:
  the callback does not verify Jenga's `hash` (formula unpublished);
  compensated by random per-attempt references + an underpayment check.
- **Payments now go through Jenga PGW hosted checkout (2026-09-24).**
  The live merchant is subscribed to PGW *Mobile Money (MPESA, Equitel)*
  and *Card* — NOT the raw STK/USSD Push API (the old `mpesa-initiate`
  got "Not Authorized" for that reason). New Edge Functions, deployed by
  hand via the Supabase dashboard (the MCP deploy tool was blocked):
  `jenga-pgw-initiate` (JWT on; booking, or laundry when `requestId` is
  passed; `JENGA_ENV=production` → live `JENGA_*` secrets +
  api.finserve.africa / v3.jengapgw.io, else sandbox) and
  `jenga-pgw-callback` (JWT off; marks paid via the `mark_*` RPCs; method
  taken from Jenga's `desc`; only *under*payment is rejected, since
  Jenga adds a fee on top). References are random per attempt so a guest
  can't forge a paid callback. Live test: `env:"live"`, real checkout
  page, **Card works** (priced 1 KES as KSh 1.04), but **MPESA fails on
  Jenga's page with error 1001 "unable to calculate charges"** at both
  0 and 1 KES — a Jenga merchant-config issue, needs Jenga support
  (message drafted in chat: ask them to enable charges/tariffs for
  Mobile Money on the live merchant). Full paid-callback loop not yet
  verified with real money.
- **BUG FOUND + FIXED IN SOURCE 2026-09-24 (redeploy needed):** a real
  1.04 KES card payment succeeded at Jenga but the site showed Failed,
  because the deployed `jenga-pgw-callback` read Jenga's documented
  field names. The REAL callback is: `responseStatus=true&transactionStatus=SUCCESS
  &orderReference&transactionReference&transactionDate&transactionAmount
  &transactionCurrency&message&paymentChannel=CARD|MPESA|EQUITEL|AIRTEL
  &secureResponse&extraData`. The source now uses those (documented names
  kept as fallbacks), marks Failed only on an explicit failure, never flips
  an already-Paid booking, and leaves unknown/processing statuses alone.
  **Until the fixed file is pasted into the Supabase dashboard function
  `jenga-pgw-callback`, every real payment is charged but shown Failed.**
  The demo booking was repaired by hand with `mark_booking_paid`.
- **Live test results 2026-09-24:** a real 1.04 KES CARD payment
  (Jenga txn ref 626712015428) completes end to end after the callback
  field-name fix — it was repaired by hand once, the fixed callback has not
  yet marked a booking Paid on its own, so verify with the next real
  payment. An abandoned or declined card produces NO callback: the booking
  stays Pending and the guest can pay again. Still untested: M-Pesa
  (Mobile) end to end — blocked on Jenga error 1001; when fixed, read the
  callback logs for the `paymentChannel` / `transactionStatus` values it
  sends for MPESA.
- **Hardening 2026-09-24 (DEPLOYED: initiate v2, callback v4; verified):**
  migration `20260924140000_payment_attempts.sql` (APPLIED) adds
  `payment_attempts` (service-role only). `jenga-pgw-initiate` records every
  attempt reference and no longer returns Jenga error text / env to the
  browser; `jenga-pgw-callback` resolves references through that table
  (old `payment_reference` lookup kept as fallback) so a guest who starts a
  second attempt can still complete the first, and logs
  `DUPLICATE PAYMENT` if a booking is paid twice (guest charged twice, may
  need a manual refund). Verified live with simulated Jenga callbacks on a temp booking
  (deleted after): unknown reference ignored; PENDING left alone;
  underpayment not accepted; explicit FAILED marks Failed; SUCCESS on an
  OLDER attempt after a newer one failed marks Paid (the orphaning bug is
  fixed); fee-inclusive amount accepted; a second SUCCESS logs DUPLICATE
  PAYMENT and changes nothing else; FAILED after Paid stays Paid. Minor:
  the duplicate success re-stamps `payment_reference` with the later
  reference (the first is in `security_events.detail`). The catch-all in
  `jenga-pgw-initiate` now returns a generic message (source updated
  2026-09-24 — redeploy `jenga-pgw-initiate` to take effect). The admin
  Security Log highlights a second successful payment as "Paid twice —
  check whether a refund is owed" (uses `detail.already_paid`; booking
  payments only, laundry duplicates are not detected). The pay card and
  its help dropdown mention that Jenga may add a small processing fee.
- **Temporary booking gate: added then REMOVED 2026-09-24** (owner asked to
  stop it). Code deleted, `site_content.booking_gate` row deleted; public
  booking is open to everyone as before.
- **NO RESERVE BEFORE PAYMENT + BLANK JENGA DETAILS (2026-09-24, owner
  request) — IN PROGRESS, needs the steps below:**
  (1) Blank customer details on Jenga's page: `jenga-pgw-initiate` now
  sends the customer name/email/phone/address BLANK so the guest types their
  own (countryCode stays KE); if Jenga refuses blanks it retries once with
  the booking's details (check logs for "rejected blank customer details").
  (2) Rooms are only taken once PAID: migration
  `20260924190000_availability_only_paid_bookings.sql` changes
  `availability_view` so a booking holds its dates only when
  `paid_at is not null` (or Blocked); unpaid / abandoned bookings no
  longer lock a room. `jenga-pgw-initiate` re-checks the view right before
  a first payment (409 "dates were just booked by another guest") and
  `jenga-pgw-callback` logs a `double_booking_conflict` security event
  (shown in the admin Security Log) if two guests still pay for the same
  dates so one can be refunded. The 3-hour stay-EXTENSION hold is
  deliberately unchanged. Site copy no longer says the room "stays
  reserved" / "Reserve". ORDER: (a) redeploy BOTH edge functions, (b) THEN
  apply the migration (applying it first would leave a window with no
  "still free?" check). STATUS 2026-09-24: functions redeployed (initiate v4, callback v5) and
  the migration APPLIED — unpaid bookings no longer hold rooms. VERIFIED
  LIVE 2026-09-24: Jenga accepted BLANK customer details on the first try (no
  fallback), and its checkout page opens with empty first/last name, email,
  phone and address; payment methods stay locked until the guest fills
  them in. Availability view checked: 0 rows while all bookings are unpaid.
- **15-MINUTE PAYMENT-WINDOW HOLD (2026-09-24, owner request):** unpaid
  bookings still never hold a room, but from the moment a guest clicks Pay
  their dates are held for 15 minutes (= Jenga's paymentTimeLimit; a 3-minute
  hold was rejected because payment can take longer and a second guest could
  then start paying mid-payment). Migration `20260924220000_payment_window_hold.sql`
  (APPLIED) adds a third branch to `availability_view` (unpaid booking with a
  `payment_attempts` row < 15 min old) and a trailing `booking_id` column.
  `jenga-pgw-initiate` now CLAIMS first (inserts the attempt), then checks no
  other paid / blocked / held booking overlaps (ignoring its own via
  `booking_id`); on overlap it deletes the claim and returns 409 "being booked
  by another guest right now"; it also releases the claim if Jenga fails.
  `jenga-pgw-callback`'s double-booking check now queries PAID/Blocked
  `bookings` only (a rival's open window is not a clash). The hold ends at 15
  min or when paid; a FAILED callback does not release it early. **Functions
  must be redeployed (initiate + callback) — status below.** Audit result: no
  code path deletes or auto-cancels an existing booking (only the booking
  form's own rollback of a half-created group, the admin cancel / ID-reject
  actions, and the daily cron that just releases an expired 3-hour
  stay-EXTENSION hold; that extension hold is unchanged).
- **SECURITY FIX 2026-09-24 (migration `20260924210000_lock_payment_functions_to_service_role.sql`, APPLIED):**
  Supabase's security advisor showed the four `mark_booking_paid` /
  `mark_booking_payment_failed` / `mark_laundry_paid` /
  `mark_laundry_payment_failed` functions were executable by any signed-in
  (`authenticated`) account via /rest/v1/rpc — the earlier `revoke ... from
  public` did not remove Supabase's default direct grant. Now executable by
  `service_role` ONLY (verified: anon/authenticated = false). Only
  `jenga-pgw-callback` calls them. LESSON: for any new SECURITY DEFINER
  function, revoke execute from `public, anon, authenticated` explicitly and
  re-run the advisor (`get_advisors` security) afterwards. Remaining advisor
  items are expected: INFO `rls_enabled_no_policy` on login_attempts /
  payment_attempts / rate_limits (service-role-only tables, by design) and
  ERROR `security_definer_view` on staff_cleaning_laundry_feed /
  staff_checkout_schedule (owner-privileged staff views guarded by
  `auth.uid()` in staff_users, by design). Leaked-password protection is not
  flagged by the advisor (i.e. enabled).
- **CLEAN SLATE 2026-09-24 (owner request): the Test Room, all test
  bookings and all test guests were DELETED.** ID photos were removed
  through the site's own check-out routine (POST /api/portal/<token>/checkout
  after blanking the guest email), storage bucket `id-documents` checked
  empty. Real rooms untouched (10 active, Room One..Ten). To run live
  end-to-end tests again, recreate a hidden-or-visible test room by copying
  Room One's photos/amenities/bed setup with FAKE door code (0000) and
  WiFi, a small price (100 KES was used), `display_order` 11, then delete
  the room, its bookings and guests afterwards. Remember: bookings on any
  room show in the admin Bookings list, dashboard totals and the staff
  schedule. The public site is OPEN (site_status.is_open = true since
  2026-09-24 18:24 UTC) — a visible test room is bookable by real guests.
  The owner's later test bookings (Room Seven / Room Eight, 3 in all) were
  deleted the same way on 2026-09-24 — the database now holds 0 bookings,
  0 guests, 0 ID files, 10 real rooms. The site was CLOSED again at 19:49
  UTC (site_status.is_open = false) and should be reopened by the owner.
- **Guest screens are live (pushed 2026-09-24, commit 360f9aa).**
  `PaymentSection` and `LaundryPaymentSection` are one "Pay with M-Pesa or
  card" button (site theme: rounded-full mocha/terracotta, not green) calling
  `jenga-pgw-initiate`, with a collapsible "Need help paying?" `PaymentNotes` card under it
  (closed by default; bold + highlighted + underlined options; includes
  "enter the cardholder name exactly as on the card") telling
  the guest to pick Mobile→Kenya→MPESA or Card on Jenga's page (Jenga's docs
  have no parameter to preselect a channel/telco or prefill the M-Pesa
  number). Repo cleanup done: the old `mpesa-*` / `jenga-card-*` /
  sandbox-test function folders, `supabase/functions/_shared`, and the
  unused polling routes are deleted. The nine old deployed functions (`mpesa-*`, `jenga-card-*`, sandbox
  tests) were DELETED from Supabase on 2026-09-24 by the owner; only
  `jenga-pgw-initiate` and `jenga-pgw-callback` remain. Test rows from the live test were
  deleted (DB back to 1 booking / 1 guest / 10 rooms).
- **M-Pesa on the live checkout still fails (Jenga error 1001, "unable
  to calculate charges")** — reproduced 3 times at 0 and 1 KES; support
  message drafted in chat, awaiting the owner sending it to Jenga.
  Last test order reference: PGWT6RFXL9U9YU7. Card works.
- **Door codes / WiFi passwords: OWNER DECISION 2026-09-24 — they will NOT
  be changed.** (They were flagged 2026-09-20 as previously exposed; the
  public-exposure hole itself is closed, and the owner has decided to keep
  the current codes.) Do not re-raise this.
- **Supabase settings checked 2026-09-24:** daily backups are ON (Pro
  plan; 8 daily physical backups listed, newest 24 Sep 05:27 UTC) — note
  they do NOT include Storage files (room photos, logo, ID uploads) and a
  restore can lose up to a day of data; point-in-time recovery is a
  separate paid add-on the owner may want once bookings are daily.
  Leaked-password protection is not flagged by the security advisor
  (enabled).
- **Clock in/out has no notification** — admin checks "Staff Shifts"
  manually. Confirmed with owner this is fine as-is, not a gap.
- **Vercel Git auto-deploy has occasionally not triggered on a push**
  (self-resolved before, no root cause found). If a merge doesn't
  produce a new deployment within a couple minutes, check
  `list_deployments` directly.
- **Checkboxes use `accent-terracotta-500`, not `text-terracotta-500`** —
  the latter only themes a checkbox with Tailwind's forms plugin, which is
  not installed, so the browser's default blue showed (fixed 2026-09-24 in
  BookingWidget, PaymentSection, CheckoutSection).
- **Zero real guest reviews yet** — homepage shows sample testimonials
  by design until real ones exist to feature via `/admin/reviews`.
- **The site logo's source file is a 1254→2508px raster (not vector)**,
  supplied directly by the owner. Sharpened via unsharp-mask, but
  there's a real detail ceiling — if a vector (SVG/AI/EPS) or larger
  export ever becomes available, swap it in for a genuinely sharper
  result instead of more sharpening.

## What's built (current state, not a build log)

**Guest flow**: browse rooms → book → pay (one button → Jenga PGW hosted
checkout, guest picks Mobile/MPESA or Card there; card live, M-Pesa
blocked on Jenga error 1001, see above) → upload ID (Dojah OCR + name-match, 2
auto attempts then manual admin review) → guest portal
(`/portal/[token]`, token-only auth, no login) unlocks door
code/WiFi/laundry/extend-stay/checkout → post-stay review. **The
portal page now clears itself** (hides the booking summary, door
code/WiFi, requests, and the "Contact Host" button — leaving only a
"Thanks for staying" card, receipt download, and the review form) the
moment either happens: the guest taps "Confirm Check-Out", or 2pm
Nairobi time arrives on the check-out date, whichever is first. The
2pm cutoff is a pure display backstop — it does **not** touch the
database or trigger `completeCheckout`'s privacy cleanup, it just stops
the page from showing sensitive info once the room should reasonably
be free. Implemented in `PortalClient.tsx` (`isCleared`/`pastCutoff`,
read inside a `useEffect` rather than during render, so server and
first client render agree and there's no hydration mismatch).

**Repo-wide lint/type audit (2026-09-23, separate from the work
above)** — `eslint`/`tsc --noEmit`/`next build` were all clean except
five real eslint errors, now fixed and pushed to `master`
(deployment `dpl_ExnQmyMaFseVUiAKA3mcKhfKzrBs`, READY): an impure
`Date.now()` call during `PortalClient`'s render (the same
`isCleared`/`pastCutoff` code above — this is where that `useEffect`
pattern came from), a `require()` in `tailwind.config.ts` (now a
proper `import`), and dead `displayCurrency` state left over in
`PaymentSection.tsx`/`LaundryPaymentSection.tsx` from the currency-
selector wiring (the selector renders its own converted amount
internally — that state was never read). No behavior change intended
beyond the render-purity fix; nothing else in the app was touched.

**Walk-in/admin-created bookings now give the guest a real portal
link** (`src/app/api/admin/bookings/manual/route.ts` +
`ManualBookingForm.tsx`) — this was a genuine, previously-unnoticed gap:
a walk-in guest had no way to reach pay/ID-upload/door-code/requests at
all before this. Guest email/phone are now optional fields on the
walk-in form; if email is given, the same `sendPaymentSucceededEmail`
every online-paid booking gets fires automatically (portal link
included); if phone is given, a "Share on WhatsApp" button pre-fills
the link. The Guest Card always shows the portal link directly too, as
a fallback. Also now supports **multiple rooms under one guest name**
in a single submission (checklist of additional rooms), mirroring the
public site's group-booking behavior — one booking per room, same
guest/dates, all-or-nothing on failure. **A real bug was found and
fixed while testing this**: manual bookings never set `paid_at`, which
`PortalClient.tsx`'s `isVerifiedAndActive` gate actually checks (not
just `payment_status`) — without it, none of the self-service sections
ever appeared even though the booking read "Paid". No real guest was
ever affected (no walk-in booking had been created through this route
before this session).

**Blast-radius reduction for guest-facing payment callbacks**
(`supabase/migrations/20260923100000_guest_payment_rpc_functions.sql`).
`mpesa-callback`, `mpesa-callback-laundry`, and `jenga-card-callback`
— the least-trusted entry points in the app, since they carry the full
service-role key and aren't signature-verified (see the Jenga gap
above) — no longer do freeform table writes. They call narrow,
single-purpose Postgres functions instead: `mark_booking_paid`,
`mark_booking_payment_failed`, `mark_laundry_paid`,
`mark_laundry_payment_failed`. `mark_booking_paid` also absorbed the
pending-extension-hold resolution logic that used to live duplicated
in `mpesa-callback`'s JS. Every call logs itself to a new
`security_events` table, surfaced as a "Security Log" section at the
bottom of `/admin/bookings` (folded in there rather than its own nav
item — same line of work as the bookings list). Watch for the same
booking appearing repeatedly, or a failed-then-paid pattern that
doesn't match what actually happened.

**Dojah ID verification, laundry payment, Admin dashboard, Staff
dashboard, Maps & directions**: unchanged from prior handoff, still
accurate — see git history (`git show <pre-09-23 commit>:HANDOFF.md`)
for the full detail on these if needed.

**Site logo**: replaced 2026-09-23 with an owner-supplied circular mark
(gold key + house line art + "PAMHOK HOMES" wordmark, no tagline) —
overwrites the same Supabase Storage files the site already reads
(`site-images/branding/icon.png`, `site-images/branding/logo.jpeg`), so
every usage (header, footer, admin nav, staff/admin login pages,
emails) picked it up with no code change. Every `<img>` using it was
also switched to `rounded-full` (several places were still
`rounded-md`/`rounded-xl`, leaving square corners around a circular
mark). **The browser tab favicon (`src/app/icon.png`, `apple-icon.png`,
`favicon.ico`) is deliberately NOT this logo** — it stays the separate
house+key+"P" mark from the earlier favicon rebuild. This was swapped
once by mistake and reverted — don't repeat that without being asked.

**Receipts**: `src/lib/receipt-image.tsx`, rendered via `next/og`'s
`ImageResponse` (Satori). Now bundles its own copy of the new logo
(`assets/branding/receipt-logo.png`, loaded from disk as a data URI,
same pattern as the receipt's fonts) instead of fetching
`SITE.logoIconUrl` over the network — logo shown enlarged, next to the
title instead of stacked above it, no subtitle line. Rendered at 3.5x
the original 600×720 design (2100×2520) for a crisper, larger image.
"Total paid" background is a brown-tinted beige (`COLORS.totalBg`,
was a pale pink); the divider under "Receipt No." and the dashed rule
under "Total paid" are both thicker/darker now. Still guest-downloadable
PNG on the portal and attached to the payment-confirmation email,
regenerated fresh every time, never stored.

**Staff clock in/out times are now timezone-consistent.** Previously
the staff clock page (renders client-side, browser's local timezone)
and the admin Staff Shifts board (renders server-side, server's
timezone — usually UTC) could show different times for the same shift.
Both now go through `src/lib/format-time.ts`, pinned to
`Africa/Nairobi` (fixed UTC+3, no DST, so no timezone library needed).

**Security posture**: unchanged from the 2026-09-13/09-20 audits
described in prior handoff versions (see git history) — still holds,
plus the new blast-radius work above. Rules that keep it closed are
unchanged: never `select("*")` on `rooms` from public/anon code; any
new table needs an explicit `anon` grant only if the public site truly
reads it; `getBookingByToken` withholds door/WiFi until verified + paid
+ not checked out; an owner-privileged view is writable past RLS by any
role holding INSERT/UPDATE on it. `SUPABASE_SERVICE_ROLE_KEY` will
**not** be rotated — standing owner decision, don't re-raise it.

## Reference

- **Real admin/staff credentials are never known to any Claude
  session, by design.** Don't type into `/admin/login` or
  `/staff/login` yourself — verify behavior via direct Supabase
  queries/API calls, or ask the owner to drive the actual UI live. (The
  owner has since driven `/admin/login` themselves multiple times this
  session via "Sign in with password" — that's fine, it's their own
  login; the rule is about *this session* never typing credentials in.)
- **Test data pattern**: create disposable guests/bookings via direct
  SQL for live verification, always clean up (`delete from ...`)
  immediately after. Never leave test rows behind. If a test booking
  had ID photos uploaded, deleting its row is NOT enough — see prior
  handoff versions (git history) for the storage-orphan cleanup
  procedure.
- **Local dev**: `npm run dev` (port 3000), or the `preview_start`
  browser tool with name `pamhok-dev` (reads `.claude/launch.json`).
  **Never run `npm run build` while a dev server is also running** —
  they share the `.next` output directory, and a build's `rm -rf .next`
  out from under a live dev server sends it into a restart loop (hit
  this twice this session). Stop the dev server first if a build is
  needed, or vice versa.
- **Google sign-in on `/admin/login` always redirects back to the
  production domain** (`pamhokhomes.com`), never `localhost`, because
  that's the callback URL registered with Google/Supabase OAuth — this
  makes testing admin-gated pages via Google sign-in impossible on a
  local dev server. Use "Sign in with password" instead for local
  testing (no OAuth redirect involved), or add
  `http://localhost:3000/**` to Supabase's Auth → URL Configuration →
  Redirect URLs allow-list as a one-time fix if this comes up often.
- **Supabase Edge Functions are a separate deploy target from
  Vercel** — a `git push` alone does not update them. Use the
  `deploy_edge_function` MCP tool explicitly. It cannot resolve
  relative imports across `supabase/functions/<name>/` and
  `supabase/functions/_shared/` the way the real Supabase CLI can — for
  anything deployed through this tool, inline shared helpers
  (`signJenga`, `corsHeaders`, email templates) into the function file
  itself rather than importing them, or the deploy fails with a
  "module not found" bundling error. This project now has three
  duplicated copies of the payment-confirmation email template
  (`src/lib/email.ts`, `supabase/functions/_shared/email.ts`,
  `jenga-card-callback/index.ts`, `mpesa-callback/index.ts`) for this
  reason — keep them in sync by hand if the copy or styling changes.
- **Postgres `CREATE OR REPLACE VIEW` only allows appending new
  columns at the end** of the existing SELECT list, and **resets a
  view's `security_invoker` option to its default** every time it's
  re-run — always re-apply `alter view ... set (security_invoker =
  false)` after replacing a `SECURITY DEFINER`-style view.
- **Supabase's default privileges grant new tables/views broad access**
  to `anon`/`authenticated` regardless of RLS — always `revoke all`
  first, then grant back only the specific columns actually needed.
- **Uploading to Supabase Storage from a script**: no MCP tool for this
  exists in this environment. Use `curl -X POST
  {SUPABASE_URL}/storage/v1/object/{bucket}/{path}` with
  `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}`, `apikey:` the
  same key, and `x-upsert: true` to overwrite — read the key from
  `.env.local`, never print it in a command's visible output.
