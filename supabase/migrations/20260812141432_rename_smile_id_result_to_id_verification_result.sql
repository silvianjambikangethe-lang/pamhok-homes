alter table public.bookings rename column smile_id_result to id_verification_result;
comment on column public.bookings.id_verification_result is 'Summary of an automated ID verification job, provider-agnostic ({ success, resultCode, resultText, actions, checkedAt }). Currently unused: no automated provider is configured, every upload goes to manual review.';
