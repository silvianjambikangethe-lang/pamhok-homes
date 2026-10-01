import { format, isToday, parseISO } from "date-fns";
import { CHECK_IN_TIME } from "@/lib/site";

// 1:00 PM in 24-hour terms — the gap between the previous guest's checkout
// (10:00 AM, see CHECK_OUT_TIME) and this time is the cleaning window, so
// the room genuinely isn't ready before it.
const CHECK_IN_HOUR_24 = 13;

// Shared between the booking confirmation step and the My Booking (portal)
// page, per Section 2 of the feature build guide — one component so the
// copy can't drift between the two places it appears.
export default function CheckInConfirmationMessage({ checkIn }: { checkIn: string }) {
  const checkInDate = parseISO(checkIn);
  const formattedDate = format(checkInDate, "EEEE, d MMMM yyyy");

  // Only meaningful on the actual check-in day — before that, there's no
  // cleaning window happening yet to report on; evaluated client-side so
  // it reads against the guest's own local clock.
  const roomStatus = isToday(checkInDate)
    ? new Date().getHours() < CHECK_IN_HOUR_24
      ? "Your room is being prepared and will be ready at " + CHECK_IN_TIME + "."
      : "Your room is ready for you, check in whenever you're ready."
    : null;

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <h2 className="font-serif text-h3 text-ink">You&apos;re all set!</h2>
      <p className="mt-2 text-sm text-ink/80">
        Check-in starts at <strong className="text-ink">{CHECK_IN_TIME}</strong> on{" "}
        <strong className="text-ink">{formattedDate}</strong>.{" "}
        {roomStatus && <strong className="text-ink">{roomStatus}</strong>}{" "}
        Once inside, please make use of the provided slippers. During your
        stay, keep an eye on your <strong className="text-ink">My Booking</strong> page (and
        your email) for cleaning day notices and checkout reminders, so you&apos;re never
        caught off guard. Laundry is billed separately from your stay, you&apos;ll only be
        asked to pay for it if you request the service.
      </p>
    </div>
  );
}
