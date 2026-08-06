import { format, parseISO } from "date-fns";

export default function PassDetails({
  guestDisplayName,
  roomName,
  checkIn,
  checkOut,
  bookingReference,
}: {
  guestDisplayName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
  qrDataUrl?: string | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/55">Guest</dt>
          <dd className="font-semibold text-ink">{guestDisplayName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/55">Room</dt>
          <dd className="font-semibold text-ink">{roomName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/55">Stay dates</dt>
          <dd className="font-semibold text-ink">
            {format(parseISO(checkIn), "d MMM")} → {format(parseISO(checkOut), "d MMM yyyy")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/55">Reference</dt>
          <dd className="font-mono font-semibold text-ink">{bookingReference ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
