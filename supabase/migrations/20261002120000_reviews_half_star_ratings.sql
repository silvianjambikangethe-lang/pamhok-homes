-- Reviews can now be given in half-star steps (1, 1.5, 2 ... 5) from a slider.
-- The column was a whole-number integer; widen it to numeric(2,1) and keep the
-- 1..5 range, adding a check that only whole or half values are stored.

alter table reviews alter column rating type numeric(2,1);

alter table reviews drop constraint if exists reviews_rating_half_steps;
alter table reviews
  add constraint reviews_rating_half_steps check (rating * 2 = trunc(rating * 2));
