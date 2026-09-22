-- Record of a content-only change (already applied): removes the PayPal
-- mentions from the live Terms & Conditions text (site_content.key='terms',
-- sections 1 "Booking & Payment" and 6 "Cancellations & Refunds"), to match
-- the PayPal removal from the code (2026-09-22) and the code's own default
-- text in src/lib/data.ts. Guarded so it only touches the row if it still
-- has the old PayPal wording — safe to run again, a no-op once applied.

update public.site_content
set value = jsonb_set(jsonb_set(value,
    '{sections,0,body}', to_jsonb('- All bookings are confirmed only once payment has been received in full through M-Pesa.
- Prices are listed in Kenyan Shillings (KES); amounts shown in other currencies are approximate conversions for reference only.
- A unique booking reference number is issued upon confirmation.'::text)),
    '{sections,5,body}', to_jsonb('- To cancel a booking, call the host on +254 704 393 189. Cancellations are handled by phone only and are not self-service through the site. This applies whether or not a refund is due, so the reservation can be removed from the calendar and the room freed up for other guests.
- A cancellation takes effect once the host confirms it on the call. The time of the call is the time that counts.
- Cancellations made at least 36 hours before check-in are eligible for a full refund.
- Cancellations made less than 36 hours before check-in are not eligible for a refund through the site. Please still call the host as soon as possible: a refund or credit may be offered at the host''s discretion, depending on the circumstances.
- If you booked more than one room, call the host to cancel one room or all of them. The same 36-hour limit applies to each room.
- Refunds are processed manually by the host (M-Pesa or bank transfer, depending on how you paid) after the cancellation is confirmed. They are not issued automatically by the site.'::text)),
  updated_at = now()
where key = 'terms'
  and value->'sections'->0->>'body' like '%PayPal%'
  and value->'sections'->5->>'body' like '%PayPal%';
