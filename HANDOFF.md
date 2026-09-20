# Pamhok Homes — Handoff / Status Summary

Last updated: 2026-09-13 (revised same day — passkeys replaced with
Google sign-in). Paste this file into a new chat to continue
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
`silvianjambikangethe-lang/pamhok-homes`, public, only `master` exists
(all merged feature branches are deleted after merge — keep doing
this, it was a 32-branch cleanup job as of 2026-09-13).

## Currently open / blocked

- **OWNER ACTION, urgent: change every room's door code and WiFi
  password.** Until 2026-09-20 they were readable by anyone on the
  internet (public API + View Source on `/rooms`), for an unknown period
  since launch — treat them as compromised. Edit them in
  `/admin/rooms`, and change the physical lock/router to match; the
  database fix stops future exposure but can't un-expose old values. API
  logs (kept ~1 week) show no anonymous writes or direct secret reads
  from 2026-09-14 onward; older than that is unknowable.
- **M-Pesa (Jenga) STK push — blocked on Jenga/Equity's side, not
  ours.** Both the private key and the Consumer Key/Secret/Merchant
  Code secrets were bad in Supabase (empty/corrupted key, then a
  sandbox-vs-production credential mixup) — both fixed and confirmed
  2026-09-13 via safe diagnostic calls that never touched a real phone
  (see `mpesa-initiate/index.ts`'s auth-failure logging, added the same
  day). With those fixed, the real, signed STK request now reaches
  Jenga's live production API and gets back `"Not Authorized to access
  the API"` — the STK/USSD Push product itself isn't enabled for the
  regenerated API credentials, even though they authenticate fine.
  Likely cause: Jenga treats a regenerated Consumer Key as a new API
  client under the hood that doesn't inherit the STK approval Equity
  granted the old one on 2026-09-12. **Owner needs to contact
  Jenga/Equity** and ask them to confirm STK/USSD push is enabled for
  the *current* API credentials — nothing left to fix in code or
  secrets. Applies to both integrations (booking's `mpesa-initiate` and
  laundry's `mpesa-initiate-laundry`) since they share the same Jenga
  account/credentials.
- **PayPal — merchant account itself is restricted by PayPal, so it's
  been deliberately switched OFF site-wide (2026-09-13), not just left
  broken.** Confirmed live: `create-order` started returning `422
  PAYEE_ACCOUNT_RESTRICTED — "The merchant account is restricted."`
  — a real account-level restriction PayPal placed, not a code/config
  issue, same category as the Jenga blocker below. Rather than leave
  guests hitting a dead "PayPal / Card" button, added a single kill
  switch: `PAYPAL_DISABLED` in `src/lib/payment-flags.ts` (currently
  `true`). This makes `isPaypalConfigured()` return false everywhere
  (blocking both create-order routes), both capture routes redirect as
  failed immediately, and the PayPal button is hidden entirely from
  both `PaymentSection.tsx` and `LaundryPaymentSection.tsx` — guests
  currently only see M-Pesa as a payment option. Refunds
  (`refundPaypalCapture`) are untouched and still work, since they're
  unaffected by the restriction. **Owner needs to log into paypal.com,
  check the Resolution Center** for what's needed to lift the
  restriction (a $0 test transaction triggered an identity/proof-of-
  service request there), then flip `PAYPAL_DISABLED` back to `false`
  once resolved — that one line is the only change needed to bring it
  back. Worth noting the account was working minutes
  before this appeared — plausibly triggered by the unusual pattern of
  several small real test orders created in quick succession.
- **Two Supabase dashboard-only settings, likely already fine.** A
  fresh advisor scan (2026-09-13) no longer flags
  `auth_leaked_password_protection` (it flags this loudly when off, so
  its absence is a good sign). The Pro plan also includes automatic
  daily backups by default. Neither is readable via any available tool
  — a 10-second glance at Authentication → Policies and Database →
  Backups would fully close this out.
- **Clock in/out has no notification** — admin checks "Staff Shifts"
  manually. Confirmed with owner this is fine as-is, not a gap.
- **Vercel Git auto-deploy has occasionally not triggered on a push**
  (a few times, self-resolved, no root cause found). If a merge doesn't
  produce a new deployment within a couple minutes, check
  `list_deployments`/`get_deployment` directly — don't assume it
  worked. An empty no-op commit to `master` has fixed it before.
- **Zero real guest reviews yet** — homepage shows sample testimonials
  by design until real ones exist to feature via `/admin/reviews`.

## What's built (current state, not a build log)

**Guest flow**: browse rooms → book → pay (PayPal live; M-Pesa
integrated but blocked on Jenga's side, see above) → upload ID (Dojah
OCR + name-match, 2 auto attempts then manual admin review) → guest
portal (`/portal/[token]`, token-only auth, no login) unlocks door
code/WiFi/laundry/extend-stay/checkout → post-stay review.

**Dojah ID verification — confirmed fully working end-to-end
(2026-09-13), two real bugs fixed along the way.** (1) `DOJAH_APP_ID`/
`DOJAH_ENV`/`DOJAH_SECRET_KEY_PRODUCTION` didn't exist in Vercel at all
despite the owner believing they'd been added — every upload was
silently falling through to manual review. Added correctly (scoped to
Production), plus the Dojah wallet needed a top-up (billing is
pre-paid per API call, ~$0.04-0.06/check per Dojah's own pricing page,
no stated expiry on unused balance). (2) Real phone camera ID photos
(front+back, often 5-10MB+ combined) were hitting Vercel's hard 4.5MB
serverless request body limit and failing with a generic "Upload
failed" before ever reaching Dojah or storage — small test images
always worked, which is what made this easy to miss initially. Fixed
in `src/lib/compress-image.ts`: downscales to 1800px max dimension and
re-encodes as JPEG client-side before upload, falling back to the
original file if compression fails or doesn't help. `IdUploadForm.tsx`
also now has a remove ("×") button on each photo slot once one's
picked, so a wrong photo can be cleared without a page reload.

**Guest portal features**: arrival card with QR verification pass,
directions (routes from guest's current location via a name-based
Google Maps destination — see "Maps & directions" below), a directions
video link, laundry request + payment (see below), a general "Need
something?" card (Assistance = real phone call, Cleaning/Other = text
request to admin+staff), stay extension with room-transfer fallback,
early-checkout checklist, downloadable payment receipt (PNG image, not
PDF — see "Receipts" below).

**Laundry payment** (added 2026-09-13): once a laundry request is
"Ready," an **admin** (not staff) sets a price on `/admin/requests`,
which moves it to a new `Awaiting Payment` status and emails the guest.
Guest pays via M-Pesa/PayPal/manual on their portal. Staff/admin are
**blocked server-side** from marking it "Returned" until
`laundry_payment_status = 'Paid'` — enforced in both
`/api/staff/requests/[id]/status` and
`/api/admin/requests/[id]/laundry-stage`, not just hidden in the UI.
Admin's Guest Requests feed shows "Returned by `<staff name>` at
`<time>`" (or "by admin"), via `guest_requests.completed_by` joined to
`staff_members` and a `guest_requests.updated_at` column set explicitly
by every route that touches status (this project sets timestamps in
app code, not DB triggers — matches `site_content`'s existing pattern).
All laundry payment fields (`laundry_amount`, `laundry_currency`,
`laundry_payment_status/method/reference`, `laundry_paid_at`) live on
`guest_requests`, fully independent of `bookings.payment_status` —
a stay payment and a laundry charge can be in flight simultaneously.

**Admin dashboard** (`/admin`): Overview, Bookings, ID Verifications,
Calendar, Guest Requests (cleaning/laundry/assistance/other, laundry
pricing lives here), Staff Shifts, Room Settings, Edit Content,
Reviews, Expenses, WhatsApp Contact, Settings (password, staff login
credentials, staff members + PINs, blocked guest names, terms content).
Admin login (`/admin/login`): two top-level choices, "Sign in with
Google" or "Sign in with password" (picking password reveals the
email/password fields, collapsed by default). Google sign-in fully
set up and confirmed working end-to-end (2026-09-13) — replaced
passkeys entirely, which kept getting intercepted by Windows' own
native passkey broker before the site's code ever got a say, making
cross-device sync unworkable in practice. Google sign-in works via
Supabase Auth's automatic identity linking: signing in with the
owner's real Google account (matching the existing admin email) lands
on the same `admin_users` row password login already uses; any other
Google account is rejected the same way a wrong password is. Google
Cloud OAuth client + Supabase provider config are both done.

**Staff dashboard** (`/staff`): one shared login (email/password) +
per-worker PIN tap-in (added to stop one worker impersonating another
via the shared login alone). Sections: Cleaning, Laundry, Clock
In/Out, Schedule (checkout-driven, computed live). Staff and admin are
**separate Supabase Auth accounts that share one browser cookie jar**
— signing into one on the same device signs the other out. Staff never
touches pricing/payment actions by design.

**Security posture** (two audits: 2026-09-13 and 2026-09-20). The
09-13 audit's "no anon write paths" claim was WRONG — a 09-20 test using
only the public API key proved an anonymous visitor could: read every
room's door code + WiFi password; insert a booking with
`payment_status='Paid'`, `id_verification_status='Verified'` and their own
`access_token` (free portal access); insert guests; and insert
`guest_requests` through the owner-privileged `staff_task_updates` view.
Cause: Supabase's default privileges grant every new table/view to
`anon`, and earlier lockdowns only narrowed `authenticated`. Fixed
2026-09-20 (migrations `20260920100000_lock_down_anon_access.sql` and
`...100100_stop_default_anon_grants.sql`; commit `447d331`): `anon` now
has SELECT on only `rooms` (public columns, no door/WiFi), `reviews`,
`site_content`, `social_links`, `availability_view`, plus the
column-level `bookings` SELECT that view needs, and NO write privilege
anywhere; the two anon INSERT policies are dropped; new objects no longer
auto-grant to `anon`. Every attack was re-run afterwards and is denied.
**Rules that keep it closed:** (1) never `select("*")` on `rooms` from
public/anon code — use `PUBLIC_ROOM_COLUMNS` in `lib/data.ts` (public
pages once shipped door codes in their page data); (2) any new table
needs an explicit `grant` to `anon` only if the public site truly reads
it, and every write goes through a server route with the service-role
client; (3) `getBookingByToken` withholds door/WiFi until verified + paid
+ not checked out (this is enforced server-side; hiding in UI isn't
enough); (4) an owner-privileged (`security_invoker=false`) view is
writable past RLS by any role holding INSERT/UPDATE on it. Other
standing items: `staff_members.pin_hash` column-locked; cron routes fail
closed; ID uploads check magic bytes; no secrets in git history.
`SUPABASE_SERVICE_ROLE_KEY` will **not** be rotated — the owner made that
call explicitly on 2026-09-13; don't re-raise it as a task.

**Receipts**: `src/lib/receipt-image.tsx`, rendered via `next/og`'s
`ImageResponse` (Satori — bundled with Next.js, no extra dependency),
styled from an owner-supplied ticket template. Guest-downloadable PNG
on the portal and attached to the payment-confirmation email.
Regenerated fresh every time, never stored.

**Maps & directions**: `src/lib/maps.ts`'s
`buildDirectionsFromCurrentLocationUrl()` builds a destination-only
Google Directions URL (no `origin` — Maps uses the visitor's current
location automatically) with the destination given as the text
`"Pamhok Homes, Nairobi, Kenya"`, not raw coordinates — coordinates
alone route correctly but display whatever POI Google has indexed at
that exact point (was showing the ground-floor tenant's name instead
of Pamhok Homes). Only shows once an admin has actually confirmed the
property's pin (`contact.maps_lat`/`maps_lng` set).

## Reference

- **Real admin/staff credentials are never known to any Claude
  session, by design.** Don't type into `/admin/login` or
  `/staff/login` yourself, even for testing — verify behavior via
  direct Supabase queries/API calls instead, or ask the owner to drive
  the actual UI live.
- **Test data pattern**: create disposable guests/bookings via direct
  SQL for live verification, always clean up (`delete from ...`)
  immediately after. Never leave test rows behind.
- **Local dev**: `npm run dev` (port 3000). If port 3000 is already
  taken by another session's server on this machine, connect directly
  via the browser tool with `url: "http://localhost:3000"` rather than
  fighting for the port or starting a second instance.
- **Supabase Edge Functions are a separate deploy target from
  Vercel** — a `git push` alone does not update them. Use the
  `deploy_edge_function` MCP tool explicitly, and diff the deployed
  content against git afterward (`get_edge_function`) to catch drift.
  The MCP deploy tool cannot resolve relative imports across
  `supabase/functions/<name>/` and `supabase/functions/_shared/` the
  way the real Supabase CLI can — for anything deployed through this
  tool, inline shared helpers into the function file itself rather than
  importing them, or the deploy will fail with a "module not found"
  bundling error.
- **Postgres `CREATE OR REPLACE VIEW` only allows appending new
  columns at the end** of the existing SELECT list — it cannot insert
  or reorder them without an error. It also **resets a view's
  `security_invoker` option to its default** every time it's re-run —
  always re-apply `alter view ... set (security_invoker = false)`
  after replacing a `SECURITY DEFINER`-style view (the four
  `staff_*` views all rely on this).
- **Supabase's default privileges grant new tables/views broad access**
  to `anon`/`authenticated` regardless of RLS. A column-specific
  `revoke`/`grant` does nothing if a broader table-wide grant already
  exists underneath it — always `revoke all` first, then grant back
  only the specific columns actually needed, per role.
