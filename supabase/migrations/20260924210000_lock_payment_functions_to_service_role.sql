-- The mark_* payment functions (20260923100000_guest_payment_rpc_functions)
-- are SECURITY DEFINER and were meant to be callable ONLY by the payment
-- callback (service role). `revoke ... from public` did not remove the
-- EXECUTE that Supabase's default privileges grant directly to `authenticated`
-- on new functions, so any signed-in account (including any Google account
-- that signs in to this project) could call them through /rest/v1/rpc/ and
-- mark a booking Paid. Found by Supabase's security advisor on 2026-09-24.
--
-- Only jenga-pgw-callback uses these, and it runs as service_role.

revoke execute on function mark_booking_paid(uuid, text, text) from public, anon, authenticated;
revoke execute on function mark_booking_payment_failed(uuid) from public, anon, authenticated;
revoke execute on function mark_laundry_paid(uuid, text, text) from public, anon, authenticated;
revoke execute on function mark_laundry_payment_failed(uuid) from public, anon, authenticated;

grant execute on function mark_booking_paid(uuid, text, text) to service_role;
grant execute on function mark_booking_payment_failed(uuid) to service_role;
grant execute on function mark_laundry_paid(uuid, text, text) to service_role;
grant execute on function mark_laundry_payment_failed(uuid) to service_role;
