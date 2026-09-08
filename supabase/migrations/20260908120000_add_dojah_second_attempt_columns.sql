-- Dojah document-analysis integration: a guest gets two automated attempts
-- (upload-id route) before being flagged for manual review. Attempt 1 uses
-- the existing id_document_path / id_selfie_path / id_verification_result
-- columns; these new columns hold attempt 2's evidence so the admin
-- verifications page can show both attempts' images and Dojah reasons side
-- by side once a booking is escalated. See src/lib/dojah.ts and
-- src/app/api/portal/[token]/upload-id/route.ts.
alter table bookings
  add column id_document_path_2 text,
  add column id_selfie_path_2 text,
  add column id_verification_result_2 jsonb;

comment on column bookings.id_document_path is 'Attempt 1''s ID photo — private storage path, never a public URL';
comment on column bookings.id_selfie_path is 'Attempt 1''s selfie — private storage path';
comment on column bookings.id_verification_result is 'Attempt 1''s Dojah result — { success, resultCode, resultText, actions, checkedAt }';
comment on column bookings.id_document_path_2 is 'Attempt 2''s ID photo, only present if attempt 1 failed automatically';
comment on column bookings.id_selfie_path_2 is 'Attempt 2''s selfie, only present if attempt 1 failed automatically';
comment on column bookings.id_verification_result_2 is 'Attempt 2''s Dojah result, only present if attempt 1 failed automatically';
comment on column bookings.id_verification_method is '''automatic'' | ''manual_override'' — automatic is now live via Dojah document analysis (src/lib/dojah.ts)';
comment on column bookings.id_verification_attempts is 'Number of automated Dojah attempts made this verification cycle (max 2 before manual-review escalation); a Dojah-side/config error does not consume an attempt';
