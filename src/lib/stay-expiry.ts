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

// Laundry pickup closes 5 hours before the 10:00 AM Nairobi check-out, i.e.
// 05:00 Nairobi = 02:00 UTC on the check-out date, so nothing is handed over
// too close to departure. Like the cutoff above it follows check_out, so an
// approved extension moves it later automatically.
const LAUNDRY_CLOSE_TIME = "T02:00:00Z";

export function laundryClosesAt(checkOut: string): number {
  return Date.parse(`${checkOut}${LAUNDRY_CLOSE_TIME}`);
}

// Laundry opens at the start of the check-in date, Nairobi time (UTC+3).
export function laundryOpensAt(checkIn: string): number {
  return Date.parse(`${checkIn}T00:00:00+03:00`);
}

export function isLaundryOpen(booking: { check_in: string; check_out: string }, now: number = Date.now()): boolean {
  return now >= laundryOpensAt(booking.check_in) && now < laundryClosesAt(booking.check_out);
}
