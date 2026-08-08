-- Manual admin bookings (Section 5 of the feature build guide) don't
-- always have a guest email — walk-ins / phone bookings may only give a
-- name. Online bookings still always collect it (enforced by the
-- booking form itself), this just stops the DB rejecting the ones that
-- don't.
alter table guests alter column email drop not null;
