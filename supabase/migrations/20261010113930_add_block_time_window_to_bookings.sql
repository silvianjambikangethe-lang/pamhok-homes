-- A Blocked booking (see bookings.booking_status = 'Blocked', created from
-- /admin/bookings' Block Dates form) can now carry a precise start/end time
-- on top of its whole-day check_in/check_out range — e.g. "block Room 2
-- today 2pm-5pm" or "today 10am through tomorrow". check_in/check_out stay
-- the whole-day span used for availability math (unchanged); these two are
-- purely for display and for flagging "this block's time is up, confirm
-- release?" in the Room Status grid (see RoomStatusCard.tsx). Null on every
-- existing block, and on any new one where the admin leaves both time
-- fields blank — a plain whole-day block has no defined end to flag.
alter table public.bookings
  add column if not exists block_start_at timestamptz,
  add column if not exists block_end_at timestamptz;
