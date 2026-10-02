-- Remember Me now also keeps the guest's phone number (opt-in at checkout)
-- so the booking form can autofill name, email and phone for a returning,
-- email-verified guest. Nullable: older rows and guests with no phone on
-- file simply have none. The guests.phone wipe at checkout is unchanged;
-- this copy is only written when the guest says yes to "remember me".

alter table remembered_guests add column if not exists phone text;
