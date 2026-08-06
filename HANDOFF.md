# Pamhok Homes — Handoff / Status Summary

Last updated: 2026-08-07. Written for continuing this project in a
**new chat** — paste a link to this file (or its contents) so the new session
has full context. This supersedes the previous version of this file (dated
2026-08-06, morning) — that one's content is folded into this one, updated
for everything since.

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

1. **Deploy somewhere + set a real domain.** Blocks almost everything
   else below. `NEXT_PUBLIC_SITE_URL` is still `http://localhost:3000` —
   baked into PayPal/M-Pesa callback URLs, QR-code verification links, and
   portal links. `MPESA_CALLBACK_URL` and `CRON_SECRET` are also still
   blank.
2. **Submit the M-Pesa Go-Live request** — needs deployment done first
   (real callback URL) and M-Pesa Portal Admin access confirmed. See the
   M-Pesa section above for the exact process.
3. **Go live with PayPal** — same-day, self-serve, whenever the owner is
   ready. See above for the exact steps.
4. **Feature real guest reviews as they come in** — the mechanism is built
   (`/admin/reviews`) but there are zero real reviews yet, so the homepage
   is still showing fake sample testimonials by design.
5. **Fill in remaining placeholder photos** — Living Room / Bedroom /
   Kitchen (homepage) and Coffee Corner / Reading Nook (About) — still
   empty, unchanged this session, wired up and ready in Edit Content.
6. **Update business expense placeholders** — Domain (.store), Vercel Pro,
   Supabase Pro all still have placeholder renewal dates (2026-09-03) and
   no amount, so the "Renewals due soon" dashboard alert will fire on the
   wrong date until corrected in `/admin/expenses`.
7. **Production credentials for Smile ID** — still sandbox.
8. **Consider rotating exposed secrets** — see the security note in the
   M-Pesa/PayPal section above. Owner's call, not urgent, not a code bug.
9. **Set up a GitHub remote** if/when the owner wants an off-machine
   backup — local git is done, this is the only remaining piece from the
   original "set up version control" ask.

---

## Reference: real admin account

Admin email: `pamhokhomes@gmail.com` — login works, password already set
by the owner (not known to any Claude session, by design — sessions can't
and shouldn't ask for it or enter it).
