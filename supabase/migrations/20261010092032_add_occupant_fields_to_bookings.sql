-- A group booking (several rooms, one request) can now name a different
-- person actually staying in an extra room — e.g. a friend taking the next
-- room over. guest_id stays the person who made the booking for every room
-- in the group (same as before: they pay, verify ID, and "your other rooms"
-- on the portal still lists every room under their own guest_id). These three
-- columns are ONLY used to redirect that one room's confirmation email/portal
-- link to the actual occupant instead of the booker — nothing else about
-- payment, verification, or portal access changes.
alter table public.bookings
  add column if not exists occupant_name text,
  add column if not exists occupant_email text,
  add column if not exists occupant_phone text;
