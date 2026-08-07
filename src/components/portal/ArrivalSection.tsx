"use client";

import { Confetti, MapPinLine, X } from "@phosphor-icons/react";
import { SITE } from "@/lib/site";
import GetDirectionsButton from "@/components/GetDirectionsButton";
import PassDetails from "@/components/portal/PassDetails";

export default function ArrivalSection({
  mapsUrl,
  guestDisplayName,
  roomName,
  checkIn,
  checkOut,
  bookingReference,
  qrDataUrl,
  adminPhone,
  showArrival,
  onShowArrival,
  onCloseArrival,
}: {
  mapsUrl: string | null;
  guestDisplayName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
  qrDataUrl: string | null;
  adminPhone: string | null;
  showArrival: boolean;
  onShowArrival: () => void;
  onCloseArrival: () => void;
}) {
  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <div className="flex items-center gap-2">
        <MapPinLine size={22} className="text-terracotta-600" />
        <h2 className="font-serif text-h3 text-ink">On your way?</h2>
      </div>
      <p className="mt-1 text-sm text-ink/65">
        Get directions to Pamhok Homes, or let us know once you&apos;re here.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <GetDirectionsButton mapsUrl={mapsUrl} />
        <button
          type="button"
          onClick={onShowArrival}
          className="focus-ring flex items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600"
        >
          I&apos;ve Arrived
        </button>
      </div>

      {showArrival && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Arrival confirmation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 p-4"
        >
          <div className="relative w-full max-w-md rounded-2xl border-2 border-terracotta-500 bg-surface p-6 shadow-warm">
            <button
              type="button"
              onClick={onCloseArrival}
              aria-label="Close"
              className="focus-ring absolute right-4 top-4 rounded-full p-1.5 text-ink/65 hover:bg-page hover:text-ink"
            >
              <X size={18} />
            </button>

            <Confetti size={32} weight="fill" className="text-terracotta-600" />
            <h2 className="mt-3 font-serif text-h2 text-ink">
              Congratulations on your arrival, welcome to Pamhok Homes!
            </h2>
            <p className="mt-2 text-sm text-ink/80">
              Show this pass to building security or reception to be let in.
            </p>

            <div className="mt-5 border-t border-taupe/20 pt-5">
              <PassDetails
                guestDisplayName={guestDisplayName}
                roomName={roomName}
                checkIn={checkIn}
                checkOut={checkOut}
                bookingReference={bookingReference}
                qrDataUrl={qrDataUrl}
              />
            </div>

            {adminPhone && (
              <div className="mt-5 border-t border-taupe/20 pt-4 text-sm text-ink/80">
                Confirm with the host: {adminPhone} · {SITE.contactEmail}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
