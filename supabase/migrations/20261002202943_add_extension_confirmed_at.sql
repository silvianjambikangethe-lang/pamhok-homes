-- A one-shot flag: set when a stay-extension payment resolves ("applied"
-- in resolvePendingExtensionAfterPayment), read and cleared the next time
-- the guest portal page loads, so the guest sees a distinct "your
-- extension payment has been received" message exactly once instead of
-- the ordinary first-check-in confirmation card re-appearing.
alter table public.bookings
  add column extension_confirmed_at timestamptz;
