# Pamhok Homes

Booking website for Pamhok Homes — Next.js + Supabase, with M-Pesa/PayPal
payments, a token-based guest portal, and an RLS-gated admin dashboard.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Open http://localhost:3000. Without Supabase configured, room pages fall back
to sample data so the site still renders — the booking form will show a
"not connected yet" message until you connect a real project.

## Connecting Supabase

1. Create a project at supabase.com (or use the existing one).
2. In **Project Settings > API**, copy the **Project URL**, **anon public
   key**, and **service_role key** into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose this to the browser)
3. In **SQL Editor > New Query**, paste and run [`supabase/schema.sql`](supabase/schema.sql).
   This creates all tables, RLS policies, both storage buckets (`id-documents`,
   private; `site-images`, public), and seeds three sample rooms you can edit
   or replace.
4. Create your admin login:
   ```bash
   node --env-file=.env.local scripts/bootstrap-admin.mjs you@example.com 'a-strong-password'
   ```
   or manually — create a user in **Authentication > Users > Add user**, then
   run in the SQL Editor (with your own values):
   ```sql
   insert into admin_users (id, email) values ('<your-auth-user-id>', 'you@example.com');
   ```
   You can now sign in at `/admin/login`.

Managing rooms (name, price, photos, description) is done directly in the
Supabase table editor on the `rooms` table — there's no "add room" screen in
the admin dashboard, since the brief didn't call for one.

## Payments

Two methods: M-Pesa and PayPal.

- **PayPal** runs as regular Next.js API routes (`src/app/api/payments/...`).
  Add your keys to `.env.local` and it works immediately — no redeploy of
  anything else needed. Charges in whatever currency the guest had selected
  in the currency switcher, falling back to USD since PayPal can't process
  KES at all.
- **M-Pesa (via Equity's Jenga API)** runs as two **Supabase Edge Functions**
  (`supabase/functions/mpesa-initiate`, `supabase/functions/mpesa-callback`),
  because the STK push callback needs a stable public URL independent of
  wherever this Next.js app ends up hosted. Settles directly into an Equity
  account (account-based settlement) — no separate payout step. Replaces an
  earlier Safaricom Daraja integration, removed at the owner's request.
  Deploy with the [Supabase CLI](https://supabase.com/docs/guides/functions)
  (or the Supabase MCP tool's `deploy_edge_function` — either works, but
  remember this is a separate deploy target from Vercel: a `git push` alone
  does **not** update the live functions):
  ```bash
  supabase functions deploy mpesa-initiate
  supabase functions deploy mpesa-callback --no-verify-jwt
  supabase secrets set JENGA_CONSUMER_KEY=... JENGA_CONSUMER_SECRET=... \
    JENGA_MERCHANT_CODE=... JENGA_ACCOUNT_NUMBER=... JENGA_ENV=sandbox \
    JENGA_CALLBACK_URL=... JENGA_PRIVATE_KEY="$(cat private_pkcs8.pem)"
  ```
  Needs an RSA key pair (private key as the `JENGA_PRIVATE_KEY` secret,
  public key uploaded via Jenga's dashboard "Edit Public Key" modal).
  `--no-verify-jwt` on the callback function only — Jenga/Finserve can't
  send a Supabase auth header. Sign up for sandbox credentials via
  Equity's Jenga developer portal. **Current status**: auth and RSA
  request-signing are confirmed working against Jenga's real sandbox; the
  STK push call itself returns `502 "Not Authorized to access the API"` —
  external to this code, Jenga/Equity hasn't authorized the merchant
  account for that product yet (see the header comment in
  `supabase/functions/mpesa-initiate/index.ts`).

Every payment button shows a clear "Payment method not yet configured"
state instead of crashing when its credentials are missing.

## Multi-currency display

The KES amount is always the authoritative figure — bookings are stored
and reported in KES only. Guests can additionally see an approximate
conversion (USD/EUR/GBP) via the currency switcher next to any price,
using free daily-cached exchange rates (frankfurter.app, no API key
needed). Selecting a currency there also decides what PayPal actually
charges; M-Pesa always charges KES regardless of the display currency.

## ID verification (manual)

Guests upload a photo of their national ID/passport **and** a selfie
(`IdUploadForm`). There is currently no automated verification provider
configured, so every upload sets `id_verification_status` to `Pending`
and `booking_status` to `Pending Verification`, landing it on
`/admin/verifications` for the host to Approve/Reject by eye — that
decision drives the door code/WiFi unlock in `src/lib/unlock.ts` (still
gated on payment also being `Paid`).

The schema keeps a ready hook for plugging an automated provider back in
later: `id_verification_method` accepts `'automatic' | 'manual_override'`,
`id_verification_attempts` counts automated retries, and
`id_verification_result` (jsonb: `{ success, resultCode, resultText,
actions, checkedAt }`) is a provider-agnostic slot for that job's result —
all currently unused. A previous version of this used Smile ID; that
integration (`src/lib/smileid.ts`, `src/lib/zip.ts`) was removed since it
required Smile ID specifically. To wire up a new provider, populate those
same three fields from `/api/portal/[token]/upload-id/route.ts`.

## Laundry requests

Guests get a dedicated "Request Laundry Pickup" button in the portal
(separate from the general "Call for Assistance" button), gated to their
active stay window. Status progresses Open → Picked Up → Cleaning →
Ready → Returned → Closed, set from the admin dashboard's requests feed;
the guest sees a simplified version of that status.

## Checkout reminders

`src/app/api/cron/checkout-reminders`, scheduled twice daily via
`vercel.json`, emails guests a "checkout is tomorrow" reminder the evening
before and a "checkout is today" reminder the morning of — one of the
guest-notification triggers wired up on the Resend email system (see
`checkoutReminderEmail` in `src/lib/email.ts`). The "Extend My Stay" flow
it promotes is fully functional today, directly in the guest portal.

## Deployment

Live on Vercel at [www.pamhokhomes.com](https://www.pamhokhomes.com),
Git-connected to this repo — merging a PR into `master` auto-deploys to
production. Production environment variables are set directly on Vercel
(dashboard only, not synced from `.env.local`); `NEXT_PUBLIC_SITE_URL`
there is the real domain, not `localhost`.

## A note on this dev machine

This machine's Application Control (WDAC) policy blocks native `.node`
binaries, which breaks Next.js's default Rust-based tooling. Two
adjustments were made to work around it, both safe to keep permanently
(they don't affect production behavior):

- Tailwind CSS is pinned to v3 (pure JS) instead of v4 (native Rust "oxide"
  engine).
- `next.config.ts` sets `typescript.ignoreBuildErrors: true` because the
  WASM fallback's type-check pass crashes on this machine. Type safety is
  still enforced by running `npx tsc --noEmit` separately, and CI/other
  machines without this restriction can re-enable it.
