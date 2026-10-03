# Pamhok Homes — Handoff / Status Summary

Last updated: 2026-10-03. Paste this file into a new chat to continue
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

- **M-Pesa on the live Jenga checkout now completes (confirmed 2026-10-02),
  resolving the earlier "error 1001, unable to calculate charges" block.**
  Evidence: booking `PMH-M75AJ7` (La Suite Lumière, 200 KES) was paid by
  real M-Pesa through Jenga PGW — not a manually-seeded test row — with a
  genuine Jenga order reference. Card continues to work reliably (several
  more real payments since 2026-09-29, e.g. `PMH-BBQXTU`, `PMH-HG9SLT`,
  `PMH-2SDFZV`). No code change is on record as "the M-Pesa fix" — the two-
  pay-button work (`a1eed8b`, sends M-Pesa a different `orderAmount` string
  format than card) looks like what unblocked it, but this was never
  confirmed against a live Jenga error 1001 reproduction, only inferred from
  the real payment succeeding.
- **ACTION NEEDED — real double-charge on `PMH-M75AJ7` (2026-10-02):** the
  guest's M-Pesa payment was submitted twice 10 minutes apart (references
  `PGWM4P79WN42R4D` at 17:36–17:39, then `PGWDDNUT4SHUJ2H` at 17:46–17:47)
  and **both succeeded at Jenga** — this is exactly the "Paid twice" case
  `mark_booking_paid` detects (`security_events` has `already_paid: true`
  for the second one). The admin Security Log on `/admin/bookings` already
  surfaces this; the booking's stored `payment_reference` is the *later*
  reference (`PGWDDNUT4SHUJ2H`) per the documented re-stamp behavior, but
  the *first* one (`PGWM4P79WN42R4D`) is what actually needs refunding.
  This is a manual action for the owner (Jenga dashboard or support) —
  nothing in code should "fix" a double real-money charge automatically.
- **New: `payment_callback_log` (added 2026-10-03, migration
  `20261003100000_payment_callback_log.sql`, APPLIED).** Every Jenga
  callback — success, failure, or mismatch — is now logged verbatim
  (`secureResponse` stored as a length only, no card data) so a payment
  that doesn't complete can be diagnosed without waiting for a fresh
  repro. Private, RLS on with no policies (service-role only). One row
  logged so far (a real CARD laundry payment, 2026-10-03).
- **Admin/staff laundry "Returned" auto-close inconsistency, found +
  fixed 2026-10-03 (PR #31, open as a draft, CI green, awaiting review).**
  The admin laundry-stage route already converted a "Returned" stage to
  "Closed" on save (`56cd8c3`) so the request drops off the open list by
  itself. The staff route (`/api/staff/requests/[id]/status` — used when
  *staff*, not the admin, taps "Mark Returned" in the Staff Laundry task
  list) never got that conversion, so a staff-closed request stayed
  stored as `"Returned"` and kept showing as open/urgent on both
  dashboards until someone tapped "Mark Closed" separately. Fixed to
  match; also fixed the admin feed's "Returned by … at …" attribution
  line, which was checking a status value that's no longer ever
  persisted for laundry.
- **Full repo + Supabase audit, 2026-10-03:** `tsc --noEmit`, `eslint .`,
  and `next build` all clean. Both deployed Edge Functions
  (`jenga-pgw-initiate` v17, `jenga-pgw-callback` v12) were pulled from
  Supabase and diffed byte-for-byte against the repo's
  `supabase/functions/*/index.ts` — **identical, no drift** (the earlier
  "deployed by hand, can drift" risk is not currently realized). All 47
  local migration files have a matching applied migration in Supabase, in
  order, nothing pending. `get_advisors` (security + performance) shows
  nothing new since the 2026-09-24 baseline — same INFO/ERROR items,
  all by design (see Security posture below) — plus two pre-existing
  INFO-level performance notes (a few unindexed FKs, one unused index on
  `payment_attempts`) and one WARN (`staff_members` has two permissive
  SELECT policies for `authenticated` — redundant, not a security hole,
  not yet cleaned up).
- **Checkout reminder simplified 2026-10-03:** one email only, sent on the
  check-out day itself (05:00 UTC = 08:00 Nairobi, 2 hours before the
  10:00 AM checkout) — the previous evening-before "checkout is tomorrow /
  extend your stay" reminder is gone entirely, per owner request. See
  `src/app/api/cron/checkout-reminders/route.ts` and `vercel.json`.
- **Door codes / WiFi passwords: OWNER DECISION 2026-09-24 — they will NOT
  be changed.** (They were flagged 2026-09-20 as previously exposed; the
  public-exposure hole itself is closed, and the owner has decided to keep
  the current codes.) Do not re-raise this.
- **Mobile card-payment timeout fix (2026-09-29), still unconfirmed:**
  `PaymentSection.tsx`'s `handlePay()` wraps the `jenga-pgw-initiate` call
  in a 30s `AbortController` timeout with an inline error message instead
  of the browser's native connection-timeout error. No repeatable mobile
  test case has existed to confirm it fixes the original symptom — watch
  for reports.
- **Vercel Git auto-deploy has occasionally not triggered on a push**
  (self-resolved before, no root cause found). If a merge doesn't
  produce a new deployment within a couple minutes, check
  `list_deployments` directly.
- **Zero real guest reviews yet** — homepage shows sample testimonials
  by design until real ones exist to feature via `/admin/reviews`.
- **The site logo's source file is a 1254→2508px raster (not vector)**,
  supplied directly by the owner. Sharpened via unsharp-mask, but
  there's a real detail ceiling — if a vector (SVG/AI/EPS) or larger
  export ever becomes available, swap it in for a genuinely sharper
  result instead of more sharpening.
- **Supabase settings checked 2026-09-24 (unchanged since):** daily
  backups are ON (Pro plan) but do NOT include Storage files (room
  photos, logo, ID uploads), and a restore can lose up to a day of data;
  point-in-time recovery is a separate paid add-on the owner may want
  once bookings are daily. Leaked-password protection is enabled.

## What's built (current state, not a build log)

**Guest flow**: browse rooms → book → pay (one button → Jenga PGW hosted
checkout, guest picks Mobile/MPESA or Card there; both methods confirmed
completing on real payments as of 2026-10-02, see above) → upload ID
(Dojah OCR + name-match, 2
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

**Repo-wide audit repeated 2026-10-03** - `eslint`/`tsc --noEmit`/`next build`
all clean again (no new errors since the 2026-09-23 pass above). Also
verified both deployed Edge Functions match the repo source exactly (no
hand-deploy drift) and every local migration is applied in Supabase. One
real bug found and fixed: see "Admin/staff laundry... auto-close
inconsistency" above.

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
