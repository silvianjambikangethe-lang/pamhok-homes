-- Reviews now take any value from 1.0 to 5.0 in tenths (for example 4.3),
-- not just half steps. numeric(2,1) already stores one decimal place and
-- the existing 1..5 range check stays, so only the half-step rule goes.

alter table reviews drop constraint if exists reviews_rating_half_steps;
