import { format, isToday, parse, parseISO } from "date-fns";
import { CHECK_IN_TIME } from "@/lib/site";

// Shared between the booking confirmation step and the My Booking (portal)
// page, per Section 2 of the feature build guide — one component so the
// copy can't drift between the two places it appears.
export default function CheckInConfirmationMessage({
  checkIn,
  checkInTimeOverride,
}: {
  checkIn: string;
  // Admin override for this one booking (see RoomStatusCard.tsx's "Check-in
  // time" control) — e.g. "2:00 PM" when cleaning ran long. Undefined/null
  // falls back to the normal site-wide CHECK_IN_TIME.
  checkInTimeOverride?: string | null;
}) {
  const checkInDate = parseISO(checkIn);
  const formattedDate = format(checkInDate, "EEEE, d MMMM yyyy");
  const effectiveCheckInTime = checkInTimeOverride || CHECK_IN_TIME;
  // The hour the room is actually ready, read back out of
  // effectiveCheckInTime rather than hardcoded, so an admin's override
  // pushes this cutoff too instead of leaving it stuck at the old time.
  const effectiveHour24 = parse(effectiveCheckInTime, "h:mm a", new Date()).getHours();

  // Only meaningful on the actual check-in day — before that, there's no
  // cleaning window happening yet to report on; evaluated client-side so
  // it reads against the guest's own local clock.
  const roomStatus = isToday(checkInDate)
    ? new Date().getHours() < effectiveHour24
      ? "Your room is being prepared and will be ready at " + effectiveCheckInTime + "."
      : "Your room is ready for you, check in whenever you're ready."
    : null;

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <h2 className="font-serif text-h3 text-ink">You&apos;re all set!</h2>
      <p className="mt-2 text-sm text-ink/80">
        Check-in starts at <strong className="text-ink">{effectiveCheckInTime}</strong> on{" "}
        <strong className="text-ink">{formattedDate}</strong>.{" "}
        {roomStatus && <strong className="text-ink">{roomStatus}</strong>}{" "}
        Once inside, please make use of the provided slippers. Switch on the
        switch outside the washroom, then press the water heater button
        inside to get hot water. During your
        stay, keep an eye on your <strong className="text-ink">My Booking</strong> page (and
        your email) for cleaning day notices and checkout reminders, so you&apos;re never
        caught off guard. Laundry is billed separately from your stay, you&apos;ll only be
        asked to pay for it if you request the service.
      </p>
    </div>
  );
}
