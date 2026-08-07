import { format, parseISO } from "date-fns";
import { CHECK_IN_TIME } from "@/lib/site";

// Shared between the booking confirmation step and the My Booking (portal)
// page, per Section 2 of the feature build guide — one component so the
// copy can't drift between the two places it appears.
export default function CheckInConfirmationMessage({ checkIn }: { checkIn: string }) {
  const formattedDate = format(parseISO(checkIn), "EEEE, d MMMM yyyy");

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <h2 className="font-serif text-h3 text-ink">You&apos;re all set! 🎉</h2>
      <p className="mt-2 text-sm text-ink/80">
        Check-in starts at <strong className="text-ink">{CHECK_IN_TIME}</strong> on{" "}
        <strong className="text-ink">{formattedDate}</strong>. Your room is being freshly
        prepared for you — once inside, please make use of the provided slippers. During your
        stay, keep an eye on your <strong className="text-ink">My Booking</strong> page (and
        your email) for cleaning day notices and checkout reminders, so you&apos;re never
        caught off guard.
      </p>
    </div>
  );
}
