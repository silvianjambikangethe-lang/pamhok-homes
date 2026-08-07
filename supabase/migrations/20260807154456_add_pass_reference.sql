-- Second reference code shown only on the guest's verification pass:
-- REF{month}/{day}-{room display_order}-{yy} from check-in date + room.
-- Computed once at booking creation and frozen here — not derived live
-- from the room's current display_order, since that's admin-editable
-- and would otherwise let the same booking's reference silently change
-- if rooms are ever reordered later.
alter table bookings add column if not exists pass_reference text;
