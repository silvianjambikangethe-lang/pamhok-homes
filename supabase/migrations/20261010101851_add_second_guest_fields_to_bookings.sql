-- A room sleeps up to 2 guests (business policy, see rooms.max_guests).
-- These hold the second guest's name/phone when a booking is for two
-- people sharing the one room — distinct from occupant_name/_email/_phone
-- above, which are for a DIFFERENT room in a group booking. Display-only:
-- no portal/payment/verification is tied to the second guest, same as how
-- the primary guest's own phone already works.
alter table public.bookings
  add column if not exists second_guest_name text,
  add column if not exists second_guest_phone text;
