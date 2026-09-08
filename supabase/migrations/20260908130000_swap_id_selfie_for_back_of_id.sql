-- Dojah's document analysis check is front+back of the ID, no selfie/
-- face-match — the guest upload flow (upload-id route, IdUploadForm) was
-- initially built collecting a selfie instead of the ID's back side; this
-- corrects it to match the actual Dojah product in use. 0 real bookings
-- existed at the time of this change, so nothing is lost by dropping the
-- selfie columns outright rather than keeping them around unused.
alter table bookings
  drop column id_selfie_path,
  drop column id_selfie_path_2,
  add column id_document_back_path text,
  add column id_document_back_path_2 text;

comment on column bookings.id_document_back_path is 'Attempt 1''s back-of-ID photo — private storage path, never a public URL';
comment on column bookings.id_document_back_path_2 is 'Attempt 2''s back-of-ID photo, only present if attempt 1 failed automatically';
