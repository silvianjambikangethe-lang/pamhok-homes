# Pamhok Homes — Handoff / Status Summary

Last updated: 2026-08-26. Written for continuing this project in a
**new chat** — paste a link to this file (or its contents) so the new session
has full context. This supersedes the previous version of this file (dated
2026-08-12) — that one's content is folded into this one, updated for
everything since. See "Session update (2026-08-26)" below for what's new.

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
   guess, not a confirmed fact. (Update 2026-08-26: the code has since
   been deployed to Supabase and merged to production on Vercel — see the
   2026-08-26 session update and the M-Pesa & PayPal section below. It's
   deployed, not yet functional — still needs the RSA key and Supabase
   secrets, which remain owner-only steps.)

---

## Session update (2026-08-26)

Picked up from the 2026-08-12 session update above. In order:

1. **Actually deployed the Jenga M-Pesa code to Supabase** — `mpesa-initiate`
   and `mpesa-callback` are now `ACTIVE` (v5/v4), running the Jenga logic
   from the 2026-08-12 session. Still not functional (missing RSA key +
   Supabase secrets — both owner-only, see Pending Issues item 3).
2. **Live PayPal credentials supplied by the owner directly in chat**,
   added to `.env.local`. Before trusting it with real money, reviewed the
   checkout code and found + fixed a real payment-bypass bug (see the
   M-Pesa & PayPal section) — a guest could've paid for a cheap booking
   and reused that PayPal order ID to mark a different, more expensive
   booking Paid. Fixed via an order-to-booking binding check.
3. **Connected Vercel to the GitHub repo** — previously deployed via a
   disconnected/manual path (no auto-deploy). Now genuinely Git-connected;
   verified with a real empty-commit test that triggered and completed a
   production deployment.
4. **Established a branch → PR → owner-merge workflow** going forward,
   instead of pushing straight to `master` — since Vercel now auto-deploys
   on merge, this keeps the owner in control of what goes live and when.
   Used for both PRs merged this session (Jenga/PayPal fix, and the
   middleware→proxy rename below).
5. **Fixed `NEXT_PUBLIC_SITE_URL`** on Vercel's Production env vars — was
   pointing at `localhost`, meaning real guests could never have completed
   a PayPal checkout redirect. Now correctly `https://www.pamhokhomes.com`.
6. **Renamed `middleware.ts` → `proxy.ts`** — Next.js 16 deprecated the
   `middleware` file convention in favor of `proxy` (identical behavior,
   per Next.js's own bundled docs in `node_modules/next/dist/docs`).
   Straight rename, verified locally (tsc clean, admin login works through
   the renamed proxy) before merging.
7. **Confirmed the live PayPal credentials are actually active in
   production** — safely, with zero transactions or PayPal API calls (see
   the M-Pesa & PayPal section for exactly how).
8. **Confirmed there is no tool, on either the Supabase or Vercel MCP
   connectors, that can list/set/delete secret or environment variable
   values** — checked twice this session via fresh ToolSearch queries. Any
   future session should stop re-checking for this and just tell the
   owner it's dashboard-only, every time.
9. **A real, recurring Vercel MCP flakiness was hit throughout this
   session**: `list_projects`/`list_teams` repeatedly returned zero
   results even when the project was confirmed live (once even
   independently verified by fetching the domain directly). It eventually
   started working with no clear trigger. Don't trust a "zero projects"
   result as proof of anything without cross-checking another way first.

---

## ⚠️ PENDING ISSUES — full summary (start here)

Everything below is consolidated from across this doc, in one place, with
what's actually needed to close each one. Nothing here is duplicated
detail-for-detail elsewhere without a pointer back to the fuller
explanation.

### Blocked on the owner specifically (Claude can't do these)

1. ~~Domain ownership check~~ — **resolved 2026-08-26.** Confirmed for
   real this time, not just claimed: `www.pamhokhomes.com` is live under
   Vercel account `silvianjambikangethe-8696's projects`, project
   `pamhok-homes` (`prj_V4kgqkjvM3TQpo6McnsQRjmEyTtA`). It's now
   **Git-connected** to `silvianjambikangethe-lang/pamhok-homes` — pushes
   to `master` (via merged PRs) auto-deploy, verified with a real
   empty-commit test that produced a `READY` production deployment. My
   Vercel MCP tool access was flaky throughout this process (repeatedly
   showed zero projects even when things were genuinely fine) — if a
   future session sees the same "zero projects" result, don't
   automatically assume the domain is gone; check the dashboard directly
   or retry. `/admin/expenses` still has a stale placeholder entry for a
   *different* domain (a ".store" one) — see item 8.
2. ~~Email notifications~~ — **all 7 trigger-specific emails merged to
   `master` and deployed to production, 2026-08-26** (PR #5
   `expand-email-notifications`, merged by the owner; confirmed `READY`
   on Vercel from commit `5499e17`). Real delivery confirmed working
   (pamhokhomes.com is verified on Resend; `EMAIL_FROM_ADDRESS=Pamhok
   Homes <bookings@pamhokhomes.com>`) — see the "Guest email
   notifications" section below for the full trigger-by-trigger map,
   including one real bug caught and fixed along the way
   (booking-confirmation was originally wired to fire on booking
   *creation*, not on payment — corrected per the owner's explicit spec,
   not left as a silent duplicate). Styled to match the site's brand
   (Fraunces headings, terracotta buttons). During PR review, a second
   real bug was caught and fixed before merge: the M-Pesa callback's
   copy of the email sender defaulted its portal link to
   `http://localhost:3000` if `NEXT_PUBLIC_SITE_URL` was ever unset as a
   Supabase secret (it never has been — that's a Vercel-only env var) —
   now defaults to `https://www.pamhokhomes.com` instead. **Still needs
   adding to Vercel's Production environment variables**
   (`RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` — currently only in local
   `.env.local`) and, for the M-Pesa side specifically, the same two as
   Supabase Edge Function secrets (dashboard-only either way, no tool
   can do this) before any of it reaches a real guest.
3. ~~M-Pesa (Jenga) config~~ — **fully configured and confirmed,
   2026-08-26.** All six Supabase secrets are set (`JENGA_CONSUMER_KEY`,
   `JENGA_CONSUMER_SECRET`, `JENGA_MERCHANT_CODE=4390718704`,
   `JENGA_ACCOUNT_NUMBER=0704393189`, `JENGA_ENV=sandbox`,
   `JENGA_PRIVATE_KEY`) — confirmed working via the same safe,
   zero-transaction technique as the PayPal check: POSTing a fake booking
   token to the live `mpesa-initiate` function returns `404 "Booking not
   found"` rather than `501 "not configured"`, which is only possible if
   all five required secrets are actually present.
   **Real gotcha worth remembering for future sessions**: merging the
   merchant-code fix's PR only redeployed the Vercel app — Supabase Edge
   Functions are a completely separate deployment target Vercel never
   touches. The actual running `mpesa-initiate`/`mpesa-callback` functions
   needed a manual redeploy via the Supabase MCP tool even after the PR
   merged; the code sitting in `master` and the code actually running on
   Supabase can silently diverge if you forget this. (Caught one own
   mistake doing this redeploy, too: hand-typing a large file's content
   into the deploy tool call introduced a stray unused line that wasn't
   in the real source — caught by re-reading the deployed function back
   with `get_edge_function` and comparing, then redeployed clean. Worth
   doing that comparison after any manual Edge Function deploy.)
   Separately, the merged `expand-email-notifications` work (see item 2
   above) wires a payment-confirmation/stay-extension email into the
   M-Pesa callback itself (`supabase/functions/_shared/email.ts`) — that
   needs its own `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS` Supabase secrets
   on top of the six `JENGA_*` ones, or that specific email will
   silently no-op.
   What's left is a real sandbox STK push test before trusting this with
   an actual booking — see the M-Pesa section above for the specific
   unconfirmed assumptions still left in the code. After that, going to
   production needs Jenga's own go-live process (contact Equity/Finserve
   — not yet researched).
4. ~~PayPal go-live~~ — **credentials are live, confirmed working.**
   Owner supplied live `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` on
   2026-08-26; added to `.env.local` and confirmed present on Vercel's
   Production environment too (verified via a safe, zero-side-effect
   check: POSTing a bogus booking token to `/api/payments/paypal/
   create-order` returned 404 "Booking not found" rather than 501 "not
   configured" — proves the live credentials are active without ever
   calling PayPal's API or moving money). **No real transaction has been
   run end-to-end** — deliberately, per the owner's instruction not to
   spend real money testing this. That's still a real gap before fully
   trusting checkout: worth one small real booking through it eventually.
   Also found and fixed a real payment-bypass bug in the same review (see
   the M-Pesa & PayPal section above) before any of this went live.
5. **Enable Leaked Password Protection** — Supabase Dashboard →
   Authentication → Policies. Currently off (protects the admin
   password against HaveIBeenPwned-listed passwords). No tool/API
   access to toggle this — dashboard only.
6. **Confirm your Supabase backup tier/settings** — Dashboard →
   Database → Backups. Paid-tier feature; no tool exposes current
   status.
7. ~~Add remaining placeholder photos~~ — **done, 2026-08-27.** Confirmed
   via `site_content`: `homepage.living_room_image_url`,
   `homepage.bedroom_image_url`, `homepage.kitchen_image_url`,
   `about.reading_nook_image_url`, and `about.coffee_corner_image_url`
   are all populated with real Supabase Storage URLs, no placeholders
   left.
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
11. ~~Rotate the Supabase service role key~~ — **done, 2026-08-27.**
    Migrated both `SUPABASE_SERVICE_ROLE_KEY` and
    `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase's legacy JWT-based keys
    to the newer independent publishable/secret key system (new values:
    `sb_publishable_...` / `sb_secret_...`), updated in Vercel Production
    and local `.env.local`, redeployed, and verified working via live
    API calls before formally **disabling the old legacy keys entirely**
    in Supabase's dashboard (API Keys > Legacy > Disable JWT-based API
    keys). Confirmed the old key is genuinely dead — a direct REST call
    using it now returns `401 "Legacy API keys are disabled"`. This also
    fully retires the service-role key that was exposed once in an
    earlier session's terminal transcript (never transmitted anywhere,
    but now moot regardless since that value no longer works at all).
    **Still outstanding, low priority:** the PayPal *sandbox* client
    ID/secret exposed in that same transcript — separate credential,
    unrelated to the Supabase rotation above. Live PayPal credentials
    (a different app registration) are what's actually in use, so the
    sandbox one sitting unrotated carries no real risk — it can't touch
    real money or the live app regardless of whether it's ever revoked.
    (A third exposed secret, the Smile ID API key, is now moot — that
    integration was removed entirely.)
12. ~~~40 deferred RLS performance optimizations~~ — **done, 2026-08-27.**
    Fixed via two migrations (`20260827000000_wrap_auth_uid_in_rls_policies.sql`,
    `20260827000001_scope_admin_policies_to_authenticated.sql`,
    `20260827000002_scope_public_policies_to_anon.sql`): wrapped
    `auth.uid()` as `(select auth.uid())` in the 10 flagged policies, and
    scoped the "admins manage X" / "anyone can view X" policy pairs to
    `authenticated`/`anon` respectively to kill the multiple-permissive-
    policy overlap. Zero semantic change — verified via direct PostgREST
    calls before and after. Supabase advisor WARN count: ~40 → 0 (2
    harmless INFO-level "unused index" notices remain, expected for
    brand-new indexes with no traffic yet).

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

**Confirmed genuinely live as of 2026-08-26: https://www.pamhokhomes.com**
— Vercel account `silvianjambikangethe-8696's projects`, project
`pamhok-homes`. Currently showing the maintenance page
(`is_open: false` in `site_content`) — that's an admin-controlled toggle
in `/admin/settings`, not a deployment problem. Also still fully runnable
locally:

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

Real credentials live in `.env.local` (gitignored) for local dev.
**Production secrets are separate** — set directly in Vercel's Production
Environment Variables (dashboard only, no tool exposes values) and in
Supabase's Edge Function Secrets (same — dashboard/CLI only). A value
being correct in `.env.local` does NOT mean it's live in production;
always verify separately (see the M-Pesa & PayPal section for how the
PayPal live-credential check was done safely, with no transaction).

---

## Git & deployment — fully wired up (was pending, now done)

GitHub remote: `silvianjambikangethe-lang/pamhok-homes`, public. **Vercel
is Git-connected to it** as of 2026-08-26 — merging a PR into `master`
auto-deploys to production. Verified for real with an empty test commit
that produced a `READY` production deployment before any real changes
were trusted to it.

**Working pattern established this session, worth continuing**: push
changes to a feature branch, open a PR (GitHub gives a direct
`.../pull/new/<branch>` URL right after `git push` — no `gh` CLI needed,
none is installed locally), let the owner review the diff on GitHub, they
click Merge themselves. Nothing auto-deploys until they do. Used for both
PR #1 (Jenga M-Pesa cutover + PayPal order-binding fix) and PR #2
(middleware→proxy rename) — both merged and confirmed deployed clean
(`state: READY`, zero runtime errors) via the Vercel MCP tools.

**A real gotcha hit this session, worth knowing about**: the Vercel MCP
connector's `list_projects`/`list_teams`/`get_git_deployment_context`
tools intermittently returned **zero projects** even when the project was
demonstrably live and, later, genuinely Git-connected — across multiple
reconnect attempts. It eventually started working correctly with no
obvious trigger (possibly just needed the Git connection to fully
propagate, or a stale token refreshed on its own). If a future session
hits the same "zero projects" result, don't conclude the deployment is
gone — cross-check by asking the owner to look at the dashboard directly,
or by fetching the live URL, before treating it as fact.

`.gitignore` correctly excludes `.env*` (confirmed — this also means
`.env.example` itself has never actually been committed, since it's swept
up by the same blanket `.env*` rule; harmless, just means it's a
local-only reference file, not something `git status` will ever show).

---

## What's live and working right now (verified, not assumed)

- **Real human email via Zoho Mail** — `hello@pamhokhomes.com`, set up
  2026-08-27. MX (3× `mx.zoho.com`/`mx2`/`mx3`), SPF
  (`v=spf1 include:zohomail.com ~all`), and DKIM
  (`zmail._domainkey.pamhokhomes.com`) all confirmed live via direct DNS
  lookup and Zoho's own "Verify all records" check; owner confirmed
  sending/receiving actually works. Runs entirely on the apex domain's
  own DNS records, completely separate from Resend's setup (which lives
  on the `send.pamhokhomes.com` subdomain) — no conflict between the two,
  confirmed by checking both independently.
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
    Village Market, Karura Forest, Nairobi National Park — the last one
    added 2026-08-27 with photo, description, and directions link, closing
    a gap where it was documented here but missing from the live data),
    **all with working "Get Directions from Pamhok Homes" buttons** built
    from precise point-to-point Maps routes. Two Food places (Artcaffe,
    Java House), both now with working directions links (Artcaffe's added
    2026-08-27). All neighborhood photos — Recreation and Food — are
    uploaded.
- **Full site content QA pass done 2026-08-27** (owner asked "run through the
  site tell me what's missing"): found and fixed a contradictory sentence
  in the About page body ("We're not a hotel chain, and we could evolve to
  one where..." → "...and we don't want to be one — ..."). Checked rooms
  (all complete with photos), social links (Instagram + TikTok, both real
  and active, no gaps), business expenses, and neighborhood content —
  no other issues found. Reviews table is still empty (0 rows), which is
  expected pre-launch, not a bug.
- **Second QA/error pass done 2026-08-27** (owner asked to "continue the web
  check for errors" after the above): fixed a typo in the homepage subtext
  ("...Thika Road Mall-along Thika Rd, Roysambu\n. Book directly with us,
  Always within reach." → "...Thika Road Mall, along Thika Rd, Roysambu.
  Book directly with us, always within reach." — the run-together
  "Mall-along", a stray line break producing an orphaned period, and a
  mid-sentence capital "Always" are all fixed). Verified all 45 photo URLs
  referenced across rooms/homepage/about/neighborhood resolve with HTTP 200
  — no broken images anywhere. Checked bookings (0 rows, expected
  pre-launch), guest_requests (0), admin_users (1, correct), and re-ran the
  security advisor — only the same two pre-existing benign items remain
  (see "RLS + advisor cleanup" note elsewhere in this file). Note: "Room
  Ten (Q)" was flagged as a possible typo (every other room follows
  "Room [Word] ([matching digit])") but the owner confirmed it's
  intentional, not a bug — left as-is.
- **10-day guest-journey simulation + Stay Extension rebuild (2026-08-27)**
  — owner asked to simulate a full 10-night guest stay (payment/ID bypassed
  as verified per their instruction) and walk every portal feature. Found
  and fixed two bugs unrelated to extensions: the "Confirming…"/"Confirming…"
  buttons on Confirm Extension and Confirm Check-Out never reset their
  loading state on success (only on error), so they'd stay stuck forever
  even though the action had actually succeeded — both fixed in
  `ExtendStaySection.tsx`/`CheckoutSection.tsx`.
  During that pass the owner gave three rounds of direct product
  instruction that together **rebuilt how stay extensions work**:
  1. An already-active (previously paid + verified) guest shouldn't lose
     access to their door code/WiFi/laundry/checkout just because they
     have a new, unpaid extension request sitting on the booking — only a
     genuinely never-paid booking still needs full payment before
     anything unlocks. (`PortalClient.tsx`'s `wasEverActive` flag, keyed
     off `paid_at` being set rather than current `payment_status`.)
  2. Extending should require the *current* stay to already be fully
     paid, and the extra nights shouldn't actually apply until *their*
     payment clears — not the moment the guest requests them. And any
     extension activity should notify admin.
  This became a real hold system, not just a flag:
  - `pending_extension_check_out` / `_nights` / `_amount` /
    `_requested_at` on `bookings` (migration
    `add_extension_hold_tracking_and_view`) — `extend/confirm` now
    requires `payment_status === 'Paid'` before accepting a request, then
    parks the new checkout date here instead of touching `check_out`
    directly; `total_amount` is bumped immediately so the existing
    PayPal/M-Pesa/manual payment flow can charge the new total with no
    changes needed on the payment side.
  - **The hold is real, not just a note**: `availability_view` was
    redefined to UNION in a synthetic occupied range for the pending
    extension window, active only while `pending_extension_requested_at`
    is under 3 hours old. This means every existing caller (new booking
    creation, other guests' extend/check and extend/confirm) automatically
    respects the hold with no new locking code — verified live that a
    second booking attempt on the held dates is correctly rejected.
  - **3-hour expiry is enforced lazily, not by cron** — this project's
    current Vercel plan only allows daily cron, which can't reliably hit
    a 3-hour SLA. `src/lib/extension-hold.ts`'s
    `releaseExpiredExtensionHold()` runs on every booking read (portal
    page, verify page, extend/check, extend/confirm) and self-heals a
    stale hold the instant anyone next looks at it — reverts
    `total_amount`, clears the pending fields, restores `payment_status`
    to `Paid` (the original nights genuinely were paid), and notifies
    admin. `cron/expire-extension-holds` (daily, registered in
    `vercel.json`) is only a backstop for a booking nobody ever reloads.
  - **Payment confirming an extension is automatic** across all three
    payment paths — PayPal capture, the M-Pesa `mpesa-callback` edge
    function (redeployed, `verify_jwt` correctly still `false` — Jenga
    can't send a Supabase auth header), and the admin's existing **Mark
    Paid** button (`/admin/bookings`, for cash/bank-transfer/other manual
    payment) — all call `resolvePendingExtensionAfterPayment()`, which
    re-checks the hold hasn't expired and nobody else took the dates
    before applying `check_out`, or reverts (amount adjusted back down,
    admin notified to check whether a refund is owed) if either
    happened. Verified all three paths live end-to-end: request → hold
    blocks a conflicting booking → Mark Paid → `check_out` updates,
    `total_amount` correct, admin gets an "Extension confirmed"
    notification; separately verified the unpaid-guard, the 3-hour
    self-heal (dates/amount correctly reverted), and that the existing
    "Stay Extension Confirmation" guest email (built in an earlier
    session) no longer fires in the rare revert case — it used to
    unconditionally claim the extension succeeded whenever
    `paid_at` was already set, which would've been wrong the one time it
    matters most.
  - **Found a real, pre-existing drift bug while wiring the M-Pesa side of
    this**: `supabase/functions/mpesa-callback/index.ts` in git (merged via
    the `expand-email-notifications` PR) calls `sendPaymentSucceededEmail`
    from `_shared/email.ts` — but the actual **live** Edge Function had no
    such call at all when read directly from Supabase. Root cause:
    Supabase Edge Functions are a separate deployment target from
    Vercel — `git push` alone never updates them, they need an explicit
    `deploy_edge_function` call (or `supabase functions deploy`), and that
    manual step was done for the earlier Jenga merchant-code PR but
    apparently missed for this one. Net effect: M-Pesa payments likely
    never sent a "Payment confirmed" or "Stay extended" email in
    production. Fixed by redeploying the function with both the email
    call and the new extension-hold logic together — verify_jwt confirmed
    still `false` (required, Jenga can't send a Supabase auth header).
    **Any future change to this file needs its own explicit redeploy** —
    a merged PR alone does not put it live. Checked `mpesa-initiate` the
    same way while here — its live content matches git byte-for-byte, no
    drift there, and its `verify_jwt: true` is correct as-is (the browser
    calls it directly with the guest's own Supabase session, unlike
    `mpesa-callback` which Jenga's server calls with no ability to attach
    any Supabase auth header). Worth periodically diffing git against
    `get_edge_function`'s live content for both functions to catch this
    class of drift early.
  - **Admin notifications** for requested / confirmed / expired-or-
    conflicted extensions all go through the existing `guest_requests`
    feed (Overview badge + `/admin/requests`) — no new admin UI needed,
    it already surfaced this generically. The admin Calendar page queries
    `bookings` fresh on every load, so a confirmed extension shows there
    automatically too.
  All test bookings/guests/reviews created during simulation and testing
  were deleted afterward — production data untouched throughout.
- **Room-transfer extension + contact-button visibility fix (2026-08-27)**
  — follow-up owner request: when a guest's own room isn't free for the
  extra nights they want, don't dead-end them — offer other rooms free
  for those same dates, and if they pick one, treat it as a genuinely
  fresh check-in rather than an awkward bolt-on:
  - `extend/check` (`src/app/api/portal/[token]/extend/check/route.ts`)
    now returns `alternateRooms` (every other active room with no
    conflict for the requested date range, name + price) whenever the
    guest's current room has a conflict, plus the computed `newCheckOut`
    so the frontend has exact dates to act on.
  - New route `extend/transfer`
    (`src/app/api/portal/[token]/extend/transfer/route.ts`): creates a
    genuinely separate `bookings` row in the chosen room — check_in is
    the guest's current check_out (so it starts the moment their current
    stay ends), its own check_out, its own `booking_reference`/
    `pass_reference`/`access_token`, `payment_status: 'Pending'`. Reuses
    the same `guest_id` (same person, not duplicated) and copies
    `id_verification_status: 'Verified'` over — no ID re-upload for a
    guest who's already vetted and currently staying — but leaves
    `terms_accepted_at` unset and payment untouched, same as any other
    booking. Re-validates availability at transfer time too (same
    race-condition guard pattern as extend/confirm). Because it's a
    genuinely new booking row, laundry (`guest_requests` scoped to
    `booking_id`) and cleaning-day notices (computed off `check_in`)
    start completely fresh for the new room — nothing carries over from
    the old one.
  - `ExtendStaySection.tsx` renders the alternate rooms as a picker
    ("Book this room" per room, its own per-button loading state so
    picking one doesn't block the others); on success, `router.push`s
    straight to the new booking's portal page.
  - **Contact-button visibility loosened**: previously both the floating
    WhatsApp widget and the inline "Contact Host on WhatsApp" button
    required the guest to have paid at least once (`wasEverActive`,
    paid_at-based — see the entry above). That's still correct for
    door code/WiFi/laundry, but it meant a guest freshly transferred to a
    new room (or anyone mid-first-payment) saw no way to reach the host
    if something went wrong. New `canContactHost` flag in
    `PortalClient.tsx` drops the payment requirement — visible to any
    ID-verified guest regardless of payment status. `ExtendStaySection`
    also gained its own inline WhatsApp + Call block, shown any time an
    error or an alternate-rooms picker appears — the two together mean a
    stuck guest is never more than one tap from reaching the host, per
    the owner's explicit ask. `VerificationPassSection`'s "pass not
    ready" message was also split into three accurate states (extension
    pending / ID verified but unpaid / not yet verified) instead of one
    generic message that used to claim ID wasn't confirmed even when it
    was — the fresh-transfer booking is exactly the case that needed
    this.
  - Verified live end-to-end through the real dev server and browser
    (not just curl): created a real conflict on a room, confirmed
    `extend/check` listed every other free room with correct pricing,
    clicked "Book this room" in the actual UI, confirmed it created a
    real second booking with the right dates/room/amount, redirected to
    its portal page, and confirmed both WhatsApp options were visible
    pre-payment with the new accurate messaging. Admin notification
    ("Guest moved to Room X for extra nights...") confirmed in
    `guest_requests`. All test data cleaned up afterward.
- **Cancellation refund flag fixed + Terms wording tightened
  (2026-08-27)** — owner asked whether the site has a cancellation/refund
  policy, then to make sure it's genuinely manual end-to-end (admin
  contacted by phone, admin sends the refund themselves, never automatic)
  and that the Terms actually say so. Found and fixed a real gap:
  `/api/admin/bookings/[id]/cancel/route.ts` only ever set
  `booking_status: 'Cancelled'` — it never touched `refund_status`, so
  cancelling a *paid* booking left no trace anywhere that a refund was
  owed. The Overview "Refunds needed" card and the Bookings table's "Mark
  Refunded" button both key off `refund_status` being non-null, so
  neither would ever surface a cancelled-but-unrefunded booking — an
  admin could cancel a paid stay and have nothing remind them money was
  still owed. Fixed by having `cancel` check `payment_status` before
  cancelling and, if it was `'Paid'`, set `refund_status: 'Needs Manual
  Refund'` — same value the existing ID-verification-rejection path
  already uses, so it plugs into the same Overview card/Mark Refunded
  button with no new UI needed. **Deliberately does not call any payment
  provider's refund API** — this mirrors the Terms' actual promise (admin
  phones the guest, sends the refund themselves via M-Pesa/bank/PayPal,
  then clicks the existing Mark Refunded button to close it out) and is
  intentionally different from the ID-rejection path, which *does*
  auto-attempt a PayPal refund for that specific, undisputed scenario —
  left untouched, out of scope for this ask.
  Verified the full loop against the database directly (no admin
  password is stored anywhere for a Claude session to use, by design —
  see "Reference: real admin account" below): a Paid test booking,
  cancelled the same way the route would, confirmed `refund_status`
  correctly flips to `'Needs Manual Refund'` and shows up in a query
  matching the Overview card's exact filter, then replicated Mark
  Refunded closing it out (`payment_status: 'Refunded'`, `refund_status`
  cleared, `refund_amount`/`refund_reference`/`refunded_at` recorded).
  Test data deleted after.
  Also tightened `/terms` Section 6 wording to match: added an explicit
  line that cancellations aren't self-service and always go through a
  phone call to the host, and a new line stating refunds are sent
  manually by the host after that call — not issued automatically by the
  site — so a guest reading the 48-hour "eligible for a full refund" line
  doesn't assume an instant automatic refund the system was never built
  to do.
- **Removed the last automatic refund in the system (2026-08-27)** —
  immediate owner follow-up after the above: pointed out that since
  payment only ever happens once ID verification is already `Verified`
  (the guest portal only shows the payment step then — see
  `PortalClient.tsx`), a rejection refunding money is an edge case, not
  the normal path, and it should never be automatic either. Found the
  actual trigger: `/api/admin/bookings/[id]/verify/route.ts`'s Rejected
  branch didn't check the booking's *current* verification state before
  applying a rejection — so an admin revoking an *earlier* approval on a
  booking that had already paid would hit a real automatic PayPal refund
  call (`refundPaypalCapture`, live credentials). Removed that call
  entirely; the Rejected branch now does exactly what `cancel/route.ts`
  does for a paid booking — sets `refund_status: 'Needs Manual Refund'`
  and nothing else — so `payment_status` and `payment_reference` are left
  completely untouched and no money moves without the admin doing it by
  hand. This was the only remaining code path anywhere in the project
  that could move real money without a human deciding to. Also dropped
  the now-dead `payment_method`/`payment_reference` columns from this
  route's select and the unused `refundPaypalCapture` import (the
  function itself is left in `lib/paypal.ts`, just unused — not deleted,
  in case a genuinely automatic refund is ever wanted again on purpose).
  Verified against the database the same way as the cancel fix: a real
  Verified+Paid test booking, rejected the same way the route would,
  confirmed `payment_status` stayed `'Paid'` and `payment_reference`
  stayed untouched (proof no refund API was ever called) while
  `refund_status` correctly flipped to `'Needs Manual Refund'`. Test data
  deleted after.
  Also narrowed `RefundStatus` (`lib/supabase/types.ts`) from `"Needs
  Manual Refund" | "Refund Failed"` down to just the one value —
  `"Refund Failed"` was only ever set by the automatic-refund-attempt
  code just removed, and leaving it in the type would misleadingly imply
  an automatic attempt still happens somewhere. Re-running the typecheck
  after that narrowing caught a real, already-*live* bug from the
  room-transfer feature earlier the same day:
  `extend/transfer/route.ts` was inserting `id_verification_method:
  "Manual"`, which isn't a valid `IdVerificationMethod` value (only
  `"automatic" | "manual_override"` are) — Postgres has no CHECK
  constraint on this column so the insert never actually errored, it just
  silently stored an inconsistent value. Fixed to `"manual_override"`,
  matching what the admin-approval path in `verify/route.ts` already
  uses for the same "a human, not the automated checker, decided this"
  meaning. Confirmed this field is never actually displayed anywhere in
  the admin UI (grepped — only read/written in API routes), so real-world
  impact was limited to data consistency, not anything a guest or admin
  would have seen.
- **Pre-review security tightening pass (2026-08-27)** — owner said the
  site is about to be externally reviewed and asked for a "no loose
  ropes, no mistakes" pass. Found and fixed one genuinely serious,
  self-inflicted regression, plus two smaller cleanups; extensively
  empirically tested rather than assumed correct given the stakes.
  1. **`availability_view` had regressed to `SECURITY DEFINER`** (fresh
     ERROR on the Supabase security advisor). Root cause: this exact
     issue was already fixed once, in an earlier session
     (`20260808221023_fix_availability_view_security_definer.sql` —
     revoke anon's broad default SELECT, grant back only the 4
     non-sensitive columns via column-level GRANT + a matching RLS
     policy, set `security_invoker = true`). Today's extension-hold
     migration used `create or replace view` to add the pending-hold
     UNION clause, which silently reset the view's `security_invoker`
     option back to Postgres's default — undoing that earlier fix
     without anyone noticing, because `CREATE OR REPLACE VIEW` doesn't
     preserve `ALTER VIEW ... SET` options.
     Fixed properly, matching the original migration's exact pattern
     (not just re-flipping the flag): the view's new WHERE clause (the
     pending-extension half) also touches `payment_status`,
     `pending_extension_check_out`, and `pending_extension_requested_at`
     — columns Postgres requires SELECT privilege on for *any* clause
     that references them, not just the SELECT list — which the
     original 4-column grant didn't cover. Granted those three
     additionally (none sensitive: an enum-like payment status and two
     hold timestamps, no guest identity attached), then re-enabled
     `security_invoker = true`.
     **Verified empirically at every step, not just by reasoning through
     it**: confirmed live (curl against the real Supabase REST endpoint
     with the actual anon key) that setting `security_invoker=true`
     before adding the grant broke the public availability check
     entirely (`permission denied for table bookings`) — caught and
     reverted within the same pass rather than left broken; confirmed
     the fixed version returns real booking data through the view as
     anon; confirmed a `Cancelled` booking's dates are correctly excluded
     from what anon sees (proving row-scoping still works, not just "no
     error thrown"); confirmed direct-table access to sensitive columns
     (`guest_id`, `total_amount`, `access_token`, `select *`) is still
     denied to anon. Advisor re-run afterward: the `security_definer_view`
     ERROR is gone, only the two long-standing accepted items remain
     (`rls_enabled_no_policy` on `login_attempts`/`rate_limits` — INFO,
     intentional default-deny; `auth_leaked_password_protection` — WARN,
     Pro-plan gated, see pending-issues item 5).
  2. **Found and removed a redundant, looser RLS policy of my own
     making.** While fixing the above, added a new anon SELECT policy on
     `bookings` before realizing a tighter one already existed
     (`"anon can view availability rows"`, scoped to
     `booking_status IN ('Confirmed','Blocked','Pending Verification')`)
     that this session simply hadn't queried `pg_policies` directly to
     see before. Permissive RLS policies OR together, so the new
     `using (true)` policy was strictly worse — it let anon see bookings
     of *any* status, silently overriding the existing policy's
     restriction. Dropped it once noticed; the pre-existing policy plus
     the column grants above are sufficient alone. Re-verified the
     Cancelled-booking exclusion test after dropping it to confirm the
     tighter scoping was actually back in effect, not just assumed.
  3. **Dropped an unused `rls_test` table** — leftover debug scaffolding
     (2 columns, `id`/`note`) from an old RLS investigation, 0 rows,
     referenced nowhere in the app or migrations (confirmed via grep
     before dropping) — the kind of stray artifact that looks odd under
     an external schema review.
  4. **`/terms` and `/privacy` now stay reachable during maintenance
     lockdown** — owner's explicit ask: these are static, non-parameterized
     pages with no Supabase reads and no session-derived content, so
     there's no security reason they need the "Shut Down Website" gate at
     all, and a real reason they shouldn't (a guest with an existing
     booking, or anyone checking policy, shouldn't hit a maintenance wall
     to read them). Added to `proxy.ts`'s exclusion regex the same way
     `/portal` and `/verify` already were. Verified the regex directly
     (not via a live toggle — flipping `is_open` would have affected the
     real production site, not just a local test, so this was checked by
     testing the exact matcher pattern against sample paths instead,
     confirming `/terms`/`/privacy` are excluded while lookalikes like
     `/terms-of-service`/`/privacyx` correctly still match, i.e. no
     over-broad exclusion). Also ran this specific diff through a
     dedicated security-review subagent independently — no findings.
  5. **Full-project sweep, nothing else found**: re-ran `npm audit`
     (0 vulnerabilities), confirmed RLS is enabled on every `public`
     table with no gaps, confirmed `availability_view` is the *only*
     view in the schema (so no other security-definer risk exists),
     confirmed no `.env*` file has ever been committed to git history,
     confirmed CSP/HSTS/X-Frame-Options/nosniff/Referrer-Policy headers
     in `next.config.ts` are already comprehensive from an earlier
     session with no gaps found, and confirmed (empirically, via direct
     REST calls) that although `anon` holds Supabase's default raw
     Postgres INSERT/UPDATE grants on every column of `bookings` (a
     platform default, not something this project set), RLS has zero
     UPDATE/DELETE policies for `anon` on any table project-wide — so
     those grants are inert. Tested this directly: attempted to PATCH a
     real test booking's `payment_status` to `'Paid'` as anon, both by
     row filter and by the booking's own valid `access_token` (i.e.
     could a guest bypass the app's server-side validation and write to
     their own booking directly?) — both denied, row confirmed unchanged
     via the service-role connection afterward. All guest-facing writes
     genuinely have to go through the Next.js API routes and their
     business logic; there is no direct-REST bypass.
  All test bookings/guests created for verification deleted afterward.
- **Terms & Conditions now admin-editable; booking-form placeholders
  removed (2026-08-27)** — two small owner requests handled together.
  1. `/terms` was the only page still fully hardcoded in
     `src/app/terms/page.tsx` (9 sections of prose/bullets/bold house
     rules) while every other page (Homepage, About, Amenities, Contact,
     Neighborhood) has been admin-editable via `/admin/content` for a
     while. Converted it to the same `site_content` pattern: new
     `TermsContent` type (`lib/supabase/types.ts`) — `last_updated` plus
     an ordered array of `{ title, body }` sections, sections addable/
     removable from the admin form just like Amenities items or
     Neighborhood places. `body` is lightweight plain-text markup rather
     than full rich text (a line starting with `"- "` renders as a
     bullet, `**text**` renders bold) — enough to reproduce the original
     page's exact formatting from a plain textarea, via a new shared
     helper (`lib/terms-render.tsx`) the public page uses to render it.
     Seeded the real database row with the original hardcoded copy
     word-for-word (including today's earlier cancellation-policy
     wording fix) so nothing changed on the live page — verified this by
     reading the rendered page back and confirming all 9 sections match,
     and by checking computed `font-weight` on every `<strong>` the
     renderer produced (all 700, all wrapping exactly the intended
     phrase — e.g. "No smoking inside the property" bold, the rest of
     that bullet plain). `/terms` gained `revalidate = 300`, matching
     About/Homepage's ISR pattern. Note: the check-in/check-out time
     bullets in Section 3 are seeded as plain text ("1:00 PM"/"10:00 AM")
     rather than pulled live from `site.ts`'s `CHECK_IN_TIME`/
     `CHECK_OUT_TIME` constants — those aren't admin-editable anywhere
     else in the app either (e.g. the check-in-confirmation email quotes
     them directly too), so this doesn't introduce a new inconsistency,
     but if those constants are ever changed in code, this section's
     wording needs a matching manual edit in `/admin/content`.
     Privacy Policy was **not** converted — only Terms was asked for, and
     it's a separate, smaller page; the same pattern could be reused for
     it later if wanted.
  2. Removed the "Jane Doe" / "jane@example.com" / "+254 7XX XXX XXX"
     example placeholders from the real public booking form's guest-
     details step (`BookingWidget.tsx`) — the owner didn't like them.
     Labels ("Full name", "Email", "Phone") are already clear without an
     example value. Left the same placeholders alone in
     `ManualBookingForm.tsx` (admin's own phone/walk-in booking form) and
     `ContactForm.tsx` (the Contact page) since only the guest booking
     form was mentioned.
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
  `JENGA_MERCHANT_CODE`, `JENGA_ACCOUNT_NUMBER`, `JENGA_ENV`,
  `JENGA_PRIVATE_KEY`) — dashboard or CLI only, same pattern the old
  Daraja `MPESA_*` secrets used.
- **Code is deployed (2026-08-26), secrets are not — and the old ones were
  removed from Supabase entirely.** Both functions are `ACTIVE` on
  Supabase (`mpesa-initiate` v5, `mpesa-callback` v4) and the code is
  merged to `master`/live on Vercel. **None of the `JENGA_*` secrets are
  currently set** — I checked twice this session (fresh ToolSearch each
  time) and confirmed neither the Supabase nor Vercel MCP connectors
  expose any tool that lists, sets, or deletes secret/env values, on any
  account state I had access to. This is dashboard-only, every time, for
  any future session too — don't keep re-checking for a tool that isn't
  coming. In the Supabase Dashboard → Edge Functions → Secrets, the owner
  needs to set all six:
  ```
  JENGA_CONSUMER_KEY=<Jenga API Key>
  JENGA_CONSUMER_SECRET=<Jenga Consumer Secret>
  JENGA_MERCHANT_CODE=4390718704
  JENGA_ACCOUNT_NUMBER=0704393189
  JENGA_ENV=sandbox
  JENGA_PRIVATE_KEY=<see below>
  ```
  Until then M-Pesa safely reports "not configured" rather than failing
  weirdly — that's the code's deliberate guard, not a bug.
- **RSA key pair generated 2026-08-26**, at the owner's request, using the
  exact `openssl` commands documented in the file. Public key was printed
  in chat for the owner to upload to their Jenga dashboard; private key
  (PKCS8 form) was also printed in chat, for the owner to paste as
  `JENGA_PRIVATE_KEY`. **The key files only exist in this session's
  temporary scratchpad directory — not committed anywhere, not saved
  durably.** If a future session needs them and they're gone, don't try
  to recover them — generate a fresh pair (same `openssl` commands) and
  have the owner re-upload the new public key; a mismatched key pair
  fails signing, it can't partially work.
- **The merchant-code/account-number confusion flagged earlier turned out
  to be real, and is now fixed (2026-08-26).** The original code guessed
  `JENGA_ACCOUNT_NUMBER` for both the OAuth token call's `merchantCode`
  *and* the STK push's `merchant.accountNumber` — the owner checked their
  actual Jenga dashboard and confirmed these are genuinely different
  values (Merchant Code `4390718704` vs. Equity account number
  `0704393189`). Fixed: `merchantCode` now has its own
  `JENGA_MERCHANT_CODE` secret, used only for authentication;
  `JENGA_ACCOUNT_NUMBER` is used only for the STK push payload and
  Signature string (the settlement account). This was the one part of the
  original credential mapping that's now **confirmed correct**, not a
  guess — the remaining unconfirmed pieces are below.
- **⚠️ Still unconfirmed against a live sandbox call, unlike the Daraja
  integration it replaces** (which was verified against Safaricom's real
  sandbox before being trusted). See the full caveats at the top of
  `supabase/functions/mpesa-initiate/index.ts`:
  - The Signature header's exact field-concatenation order and whether it
    applies to this endpoint at all is still per Jenga's docs alone, not
    a real test.
  - Which field in the STK response (`reference` vs `transactionId`)
    matches the callback's `transactionReference` is still unconfirmed.
  Once all six secrets above are set, this needs one real sandbox STK
  push before it's trusted with an actual booking.
- **Going to production M-Pesa** will need Jenga's own go-live process
  (contact Equity/Finserve — this hasn't been researched yet, unlike the
  Daraja go-live process this replaces).
- **PayPal is live and confirmed working, as of 2026-08-26.** Owner
  supplied real `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` directly in
  chat; added to `.env.local` for local dev. Whether they'd also made it
  onto Vercel's Production env vars was unclear — verified safely,
  **without running any transaction or calling PayPal's API**: POSTing a
  bogus booking token to `/api/payments/paypal/create-order` on the live
  site returned `404 "Booking not found"` rather than `501 "not
  configured"`. The route checks `isPaypalConfigured()` before it ever
  looks up a booking or touches PayPal, so a 404 there is only possible
  if real credentials are active in production. **Still genuinely
  untested: no real transaction has gone through end-to-end** — the owner
  explicitly asked that no test spend real money, so this remains
  unverified in that specific sense until a real booking goes through it.
  Also worth checking: some reports as of mid-2026 suggest PayPal doesn't
  currently offer business accounts in Kenya (only personal) — confirm
  directly on PayPal's own site if that matters for this account.
- **A real payment-bypass bug was found and fixed before any of this went
  live**: `capture/route.ts` used to trust whatever PayPal order ID was
  in the URL without checking it belonged to the booking being marked
  paid — a guest could've paid for a cheap booking and reused that order
  ID to mark a different, more expensive booking Paid. `create-order` now
  binds the order to its booking (`payment_reference`); `capture` verifies
  the match before trusting a capture. Shipped in the same PR as the
  Jenga cutover (PR #1, merged 2026-08-26).
- **Security note for the owner, resolved 2026-08-27**: a prior session's
  unredacted terminal command briefly printed several real secret values
  (Supabase service role key, PayPal sandbox client ID/secret) into that
  session's tool-output transcript while inspecting `.env.local`. Nothing
  left the local machine at the time, but both have since been formally
  rotated/disabled regardless — see the pending-issues section for the
  full story on each. Separately, this session's chat
  contains the Jenga sandbox Consumer Key/Secret, the Equity account
  number, and the live PayPal Client ID/Secret the owner pasted directly
  — the PayPal ones are real, non-sandbox credentials sitting in this
  conversation's history, worth being aware of.

---

## Guest email notifications — trigger map (2026-08-26)

Owner specified 7 exact triggers; built to match, not guessed at. All
templates live in `src/lib/email.ts` (Fraunces heading, terracotta button,
`Plus Jakarta Sans` body — matches the site's own font choices). Every
send is best-effort and swallows its own errors (`sendEmail()`/
`sendPaymentSucceededEmail()`) — a failed email never fails the
underlying booking/payment/admin action.

1. **Booking Confirmation** — on `payment_status` becoming `'Paid'`, not
   on booking creation. **This was a real bug, caught and fixed, not a
   duplicate**: the first version of this feature (merged as PR #3) sent
   it from `/api/bookings` at creation time — wrong per the owner's spec,
   since a freshly created booking is still just an unpaid hold. Removed
   from there; now fires from the single shared
   `sendPaymentSucceededEmail()` in `src/lib/booking-emails.ts`, called
   from all three places `payment_status` can actually become `'Paid'`:
   `/api/payments/paypal/capture`, the Jenga M-Pesa callback (its own
   duplicate implementation, `supabase/functions/_shared/email.ts` — Deno
   can't import the Next.js lib), and the admin's manual
   `/api/admin/bookings/[id]/mark-paid`. (The admin's *other* "mark paid
   at creation" route, `/api/admin/bookings/manual`, was deliberately left
   alone — it never collects a guest email at all, so there's nothing to
   send to.)
2. **ID Verification Result** — `/api/admin/bookings/[id]/verify`, both
   branches. Rejected includes a refund line **only when
   `payment_status` was actually `'Paid'` at rejection time** — most
   rejections happen before payment (verification is required before
   payment can even start), so most Rejected emails carry no refund
   mention at all, matching the owner's exact spec.
3. **Checkout Reminder, evening before (8 PM EAT)** — the existing
   `checkout-reminders` cron, unchanged trigger, content updated to add
   an "Extend my stay" button linking to the portal.
4. **Checkout Reminder, morning of (9 AM EAT)** — same cron, more direct/
   urgent copy ("Checkout is today"), CTA is "Confirm checkout" instead.
   Both cron times were already correct in `vercel.json` from the earlier
   session (17:00 UTC / 06:00 UTC = 8 PM / 9 AM EAT) — nothing to change
   there.
5. **Stay Extension Confirmation** — shares trigger #1's `payment_status
   = 'Paid'` moment. Distinguished from a fresh booking's first payment by
   checking whether `paid_at` was already set *before* this payment
   (`extend/confirm/route.ts` resets `payment_status` to `'Pending'` on
   top of an already-paid booking, so a second "Paid" transition can only
   mean an extension re-payment). Copy deliberately says "total confirmed
   for your stay," not "amount paid for the extension" — the schema
   doesn't track the extension as a separate line item
   (`extend/confirm/route.ts`'s own comment says so), so the email doesn't
   claim a precision the system doesn't have.
6. **Laundry Status Updates** — `/api/admin/requests/[id]/laundry-stage`,
   fires only for the 4 stages the owner listed (Picked Up / Cleaning /
   Ready / Returned) — not `Open` (guest already knows, they made the
   request) or `Closed` (internal bookkeeping only).
7. **Checkout Complete** — `/api/portal/[token]/checkout`, right after
   `checked_out_at` is set, includes a "Leave a review" button to the
   portal (reviews are submitted in-portal via `ReviewForm.tsx`, no
   separate page). Sent after the route's existing privacy cleanup, which
   is safe — that cleanup wipes the ID photos and phone number, not email.

**Verified for real, not just typechecked**: sent actual test emails
through the live Resend account for the base pipeline and for the most
logically complex template (ID-verification-rejected-with-refund-note) —
both delivered correctly to a real inbox.

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
2. ~~Email notifications~~ — **done, 2026-08-26.** pamhokhomes.com was
   already verified on Resend; `EMAIL_FROM_ADDRESS` set to
   `Pamhok Homes <bookings@pamhokhomes.com>` and real delivery confirmed.
   See the pending-issues item above for the full story. Only remaining
   step: add `EMAIL_FROM_ADDRESS` to Vercel's Production env vars
   (currently only in local `.env.local`).
3. **Get M-Pesa (via Jenga) working in sandbox, then go live** — code is
   deployed (2026-08-26), but blocked on two owner-only steps: generating
   an RSA key pair, and setting the `JENGA_*` Supabase secrets (no tool
   available to any Claude session can do either). See the M-Pesa section
   above for exactly what's missing.
4. ~~Go live with PayPal~~ — **done, 2026-08-26.** Live credentials
   confirmed active in production (see the M-Pesa & PayPal section for how
   this was verified with zero transactions). Still genuinely untested
   end-to-end with a real payment, by the owner's own choice not to spend
   real money testing — worth doing once comfortable.
5. **Feature real guest reviews as they come in** — the mechanism is built
   (`/admin/reviews`) but there are zero real reviews yet, so the homepage
   is still showing fake sample testimonials by design.
6. ~~Fill in remaining placeholder photos~~ — **done, 2026-08-27.** All
   5 confirmed populated with real Supabase Storage URLs (see the
   pending-issues item above).
7. ~~Update business expense placeholders~~ — **done, 2026-08-27.**
   Domain entry was already correct (real `.com`, $19.99/yr, confirmed
   against Hostinger's actual renewal pricing). Vercel Pro ($20/mo) and
   Supabase Pro ($25/mo) both filled in with real amounts and a
   placeholder due-date set a year out so they won't falsely trigger
   the "Renewals due soon" alert; also removed a duplicate stale
   Supabase Pro row from an earlier session. Resend Pro ($20/mo) added
   as a new not-yet-subscribed entry for the same reason (Free tier's
   100/day cap). None of these are actually subscribed to yet — see
   the pending-issues section for what each unlocks.
8. ~~Rotate exposed secrets~~ — **fully done, 2026-08-27.** Supabase
   side: migrated to the new key system, then formally disabled the
   old legacy keys — confirmed dead via a live `401` test, not just
   unused (see pending-issues item 11 for the full story). PayPal
   side: the exposed sandbox app's "Secret key 1" was disabled directly
   in PayPal's Developer Dashboard (Apps & Credentials → Pamhok Homes
   sandbox app) — confirmed the badge persisted after a fresh page
   reload, and confirmed the live PayPal integration (separate app
   registration entirely) still works correctly afterward via a safe
   zero-side-effect check.
9. ~~Set up a GitHub remote~~ — **done.** Repo is
   `silvianjambikangethe-lang/pamhok-homes` on GitHub, pushed and current.
10. ~~Resolve the Vercel/domain contradiction~~ — **resolved, 2026-08-26.**
    Confirmed genuinely live and now Git-connected. See pending-issues
    item 1 and the "Git & deployment" section for the full story,
    including a heads-up about flaky Vercel MCP tool results along the way.
11. ~~Exercise the new lockout → email-recovery cycle for real~~ —
    **done, 2026-08-27.** Owner confirmed the full cycle end-to-end:
    3 failed attempts triggers lockout, the reset email actually lands,
    and clicking through resets the password successfully. Running
    this real test caught and fixed two genuine bugs along the way:
    Supabase Auth's Site URL and Redirect URL allow-list were still
    pointing at `localhost` (fixed to the real domain), and Supabase's
    default 2 emails/hour cap was silently dropping the recovery email
    (fixed by wiring up Resend as Supabase's custom SMTP provider,
    which also raised the cap to 30/hour — later tuned to 10/hour
    specifically for this admin-recovery channel, per the owner's
    request; guest-facing emails are unaffected since they go through
    Resend directly, not through this Supabase-limited channel).
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
