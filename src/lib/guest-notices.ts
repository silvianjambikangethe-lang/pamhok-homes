import { differenceInCalendarDays, format, parseISO } from "date-fns";

export interface GuestNotice {
  id: string;
  message: string;
}

// Shared by the My Booking page (client-side, using the guest's own
// clock) and, later, the scheduled reminder job (server-side) - one
// function so the day/time math can't drift between the two places it's
// used. `now` is injectable for testing; defaults to the real clock.

// Section 3: checkout-day reminders.
export function getCheckoutNotices(checkOut: string, now: Date = new Date()): GuestNotice[] {
  const checkOutDate = parseISO(checkOut);
  const isCheckoutDay = format(now, "yyyy-MM-dd") === format(checkOutDate, "yyyy-MM-dd");
  if (!isCheckoutDay) return [];

  const minutesNow = now.getHours() * 60 + now.getMinutes();

  if (minutesNow >= 10 * 60) {
    return [
      {
        id: "checkout-now",
        message:
          "It's checkout time! Please confirm your checkout below. Our cleaning team will arrive in about 30 minutes.",
      },
    ];
  }

  if (minutesNow >= 9 * 60 + 30) {
    return [
      {
        id: "checkout-reminder",
        message:
          "Checkout reminder: your stay ends today at 10:00 AM. Please prepare to check out.",
      },
    ];
  }

  return [];
}

// Section 4: recurring cleaning notices for stays of 4+ nights, every 2
// days starting day 2 (2, 4, 6...), skipping any day that lands exactly
// on checkout (that's handled by the checkout flow, not a mid-stay
// notice). Stays under 4 nights get no cleaning notices at all.
export function getCleaningNotices(
  checkIn: string,
  checkOut: string,
  now: Date = new Date(),
): GuestNotice[] {
  const checkInDate = parseISO(checkIn);
  const checkOutDate = parseISO(checkOut);
  const stayLength = differenceInCalendarDays(checkOutDate, checkInDate);
  if (stayLength < 4) return [];

  const todayOffset = differenceInCalendarDays(now, checkInDate);
  const isCleaningDay = todayOffset >= 2 && todayOffset % 2 === 0 && todayOffset < stayLength;
  if (!isCleaningDay) return [];

  return [
    {
      id: `cleaning-day-${todayOffset}`,
      message: "Cleaners are coming to clean your room today.",
    },
  ];
}
