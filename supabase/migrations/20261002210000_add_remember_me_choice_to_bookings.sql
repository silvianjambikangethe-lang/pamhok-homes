-- The guest's answer to "remember me?", saved the moment they pick Yes or No
-- so the question never reappears after a page reload (e.g. coming back from
-- a laundry payment). Applied for real at check-out (see completeCheckout).
alter table public.bookings
  add column if not exists remember_me_choice boolean;
