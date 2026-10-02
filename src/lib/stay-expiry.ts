// One definition of "this stay is over", so the guest card (QR pass), its
// public verification page, the door code and WiFi, and guest requests all
// switch off at the same moment, whether or not the guest tapped Check Out.
//
// The cutoff is 3 hours after the 10:00 AM Nairobi check-out time, i.e.
// 13:00 Nairobi = 10:00 UTC (Kenya is a fixed UTC+3), on the check-out date.
// check_out only moves when an extension is approved, so an approved
// extension automatically pushes this out. The guest's own portal page
// clears itself at the same moment (see PortalClient).
const CUTOFF_TIME = "T10:00:00Z";

export function stayEndsAt(checkOut: string): number {
  return Date.parse(`${checkOut}${CUTOFF_TIME}`);
}

export function isStayOver(
  booking: { check_out: string; checked_out_at?: string | null },
  now: number = Date.now(),
): boolean {
  return !!booking.checked_out_at || now >= stayEndsAt(booking.check_out);
}
