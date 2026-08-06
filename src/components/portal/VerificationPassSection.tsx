import { Info, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { SITE } from "@/lib/site";
import PassDetails from "@/components/portal/PassDetails";

export default function VerificationPassSection({
  isReady,
  guestDisplayName,
  roomName,
  checkIn,
  checkOut,
  bookingReference,
  qrDataUrl,
}: {
  isReady: boolean;
  guestDisplayName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
  qrDataUrl: string | null;
}) {
  if (!isReady) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-gold-500/25 bg-page p-5 text-sm text-ink/80 shadow-card">
        <Info size={20} className="mt-0.5 shrink-0 text-terracotta-600" />
        <p>
          Your verification pass will be available once your ID is confirmed
          and payment is complete.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-terracotta-500 bg-surface p-6 shadow-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SITE.logoIconUrl} alt={SITE.name} className="h-8 w-8 rounded-md" />
      <div className="mt-3 flex items-center gap-2">
        <SealCheck size={24} weight="fill" className="text-success" />
        <h2 className="font-serif text-h3 text-ink">Verified Guest</h2>
      </div>
      <p className="mt-1 text-sm text-ink/65">
        Show this to building security or reception on arrival.
      </p>

      <div className="mt-5">
        <PassDetails
          guestDisplayName={guestDisplayName}
          roomName={roomName}
          checkIn={checkIn}
          checkOut={checkOut}
          bookingReference={bookingReference}
          qrDataUrl={qrDataUrl}
        />
      </div>

      <div className="mt-5 border-t border-gold-500/20 pt-4 text-sm text-ink/80">
        Confirm with the host: {SITE.phone} · {SITE.contactEmail}
      </div>
    </div>
  );
}
