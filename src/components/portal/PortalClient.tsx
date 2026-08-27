"use client";

import { useEffect, useState } from "react";
import { format, isPast, parseISO, startOfDay } from "date-fns";
import { Broom, CalendarBlank, ClockCountdown, Info, Phone, WhatsappLogo } from "@phosphor-icons/react";
import type { PortalBooking } from "@/lib/portal";
import type { DisplayCurrency } from "@/lib/currency";
import { whatsappLink } from "@/lib/site";
import { useWhatsappVisibility } from "@/components/WhatsappVisibilityContext";
import PageBanner from "@/components/PageBanner";
import PaymentSection from "@/components/portal/PaymentSection";
import IdUploadForm from "@/components/portal/IdUploadForm";
import UnlockedSection from "@/components/portal/UnlockedSection";
import LaundrySection from "@/components/portal/LaundrySection";
import ExtendStaySection from "@/components/portal/ExtendStaySection";
import CheckoutSection from "@/components/portal/CheckoutSection";
import { getCheckoutNotices, getCleaningNotices } from "@/lib/guest-notices";
import ReviewForm from "@/components/portal/ReviewForm";
import VerificationPassSection from "@/components/portal/VerificationPassSection";
import ArrivalSection from "@/components/portal/ArrivalSection";
import CheckInConfirmationMessage from "@/components/portal/CheckInConfirmationMessage";
import { firstNameLastInitial } from "@/lib/guest-display-name";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-[#A7866A] text-cocoa dark:bg-gold-500 dark:text-espresso",
  Paid: "bg-forest-500 text-mousse dark:bg-sage-500 dark:text-espresso",
  Failed: "bg-danger text-mousse dark:text-white",
};

export default function PortalClient({
  booking,
  token,
  rates,
  qrDataUrl,
  adminPhone,
  mapsUrl,
}: {
  booking: PortalBooking;
  token: string;
  rates: Record<DisplayCurrency, number>;
  qrDataUrl: string | null;
  adminPhone: string | null;
  mapsUrl: string | null;
}) {
  const [showArrival, setShowArrival] = useState(false);
  const checkOutDate = startOfDay(parseISO(booking.check_out));
  const isCheckoutDay = isPast(checkOutDate) || format(checkOutDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const checkoutNotices = getCheckoutNotices(booking.check_out);
  const cleaningNotices = getCleaningNotices(booking.check_in, booking.check_out);
  const isPassReady =
    booking.payment_status === "Paid" && booking.id_verification_status === "Verified";
  // Distinct from isPassReady: a guest who has already been ID-verified
  // and paid at least once (paid_at set) stays "active" even if a later
  // stay extension puts payment_status back to Pending — they're already
  // in the room, so an unpaid top-up for extra nights shouldn't lock them
  // out of the door code/WiFi/laundry/checkout they already have. A
  // brand-new booking (paid_at still null) still needs the full
  // isPassReady gate before any of that unlocks for the first time.
  const wasEverActive = booking.id_verification_status === "Verified" && !!booking.paid_at;
  const isVerifiedAndActive = wasEverActive && !booking.checked_out_at;
  const passReference = booking.pass_reference;

  const { setHidden } = useWhatsappVisibility();
  // Hide the floating WhatsApp button only on the payment-pending / ID-
  // verification step for a brand-new booking — everywhere else on the
  // site (and everywhere else in the portal, once ever verified) it stays
  // visible.
  useEffect(() => {
    setHidden(!wasEverActive);
    return () => setHidden(false);
  }, [wasEverActive, setHidden]);

  return (
    <div>
      <PageBanner
        color="taupePortal"
        eyebrow="Your Stay"
        title={booking.room?.name ?? "Pamhok Homes"}
      />

      <div className="container-page max-w-3xl py-12 sm:py-16">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2 text-sm text-ink/80">
          <CalendarBlank size={18} className="text-terracotta-600" />
          {format(parseISO(booking.check_in), "EEE, d MMM yyyy")} →{" "}
          {format(parseISO(booking.check_out), "EEE, d MMM yyyy")}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[booking.payment_status]}`}
        >
          Payment: {booking.payment_status}
        </span>
        <span className="ml-auto font-serif text-lg font-semibold text-ink">
          {formatCurrency(booking.total_amount, booking.currency)}
        </span>
        {booking.booking_reference && (
          <span className="w-full font-mono text-xs text-ink/65">
            Booking reference: {booking.booking_reference}
          </span>
        )}
      </div>

      {isPassReady && !booking.checked_out_at && (
        <div className="mt-6">
          <CheckInConfirmationMessage checkIn={booking.check_in} />
        </div>
      )}

      {wasEverActive && adminPhone && (
        <a
          href={whatsappLink(
            adminPhone,
            booking.booking_reference
              ? `Hi! I have a question about my booking ${booking.booking_reference}.`
              : "Hi! I have a question about my booking.",
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring mt-4 flex items-center justify-center gap-2 rounded-full bg-success px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <WhatsappLogo size={18} weight="fill" />
          Contact Host on WhatsApp
        </a>
      )}

      <div className="mt-8 space-y-6">
        <VerificationPassSection isReady={isPassReady} wasEverActive={wasEverActive} />

        {isVerifiedAndActive && (
          <ArrivalSection
            mapsUrl={mapsUrl}
            guestDisplayName={firstNameLastInitial(booking.guest?.full_name)}
            roomName={booking.room?.name ?? "Pamhok Homes"}
            checkIn={booking.check_in}
            checkOut={booking.check_out}
            bookingReference={passReference}
            qrDataUrl={qrDataUrl}
            adminPhone={adminPhone}
            showArrival={showArrival}
            onShowArrival={() => setShowArrival(true)}
            onCloseArrival={() => setShowArrival(false)}
          />
        )}

        {booking.id_verification_status === "Not Submitted" && (
          <IdUploadForm token={token} rejected={false} />
        )}
        {booking.id_verification_status === "Rejected" && booking.booking_status !== "Cancelled" && (
          <IdUploadForm token={token} rejected={true} />
        )}
        {booking.id_verification_status === "Rejected" && booking.booking_status === "Cancelled" && (
          <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-ink shadow-card">
            <Info size={20} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="font-semibold text-ink">This booking was declined</p>
              <p className="mt-1">
                We weren&apos;t able to verify your ID for this booking, so it
                has been declined and your dates have been released.{" "}
                {booking.payment_status === "Refunded"
                  ? "A full refund has been issued to your original payment method."
                  : booking.refund_status
                    ? "Your refund is being processed and will be completed shortly."
                    : "No payment was taken for this booking."}
              </p>
            </div>
          </div>
        )}
        {booking.id_verification_status === "Pending" &&
          booking.booking_status !== "Pending Verification" && (
            <IdUploadForm
              token={token}
              rejected={true}
              attemptsLeft={Math.max(0, 3 - booking.id_verification_attempts)}
            />
          )}
        {booking.id_verification_status === "Pending" &&
          booking.booking_status === "Pending Verification" && (
            <>
              <div className="flex items-start gap-3 rounded-2xl border border-gold-500/40 bg-gold-500/15 p-5 text-sm text-cocoa dark:text-espresso shadow-card dark:bg-gold-500/20">
                <Info size={20} className="mt-0.5 shrink-0 text-cocoa dark:text-espresso" />
                <div>
                  <p className="font-semibold text-cocoa dark:text-espresso">Your ID is under review</p>
                  <p className="mt-1">
                    We weren&apos;t able to verify your ID automatically, so your
                    host will review it manually and confirm shortly. Your dates
                    are held in the meantime, and payment unlocks once
                    you&apos;re verified.
                  </p>
                </div>
              </div>
              {adminPhone && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-terracotta-300 bg-terracotta-50/60 p-5 text-sm text-ink shadow-card dark:border-terracotta-700/40 dark:bg-terracotta-700/10">
                  <p>
                    Your ID has been sent to the host for review. Need it sorted
                    sooner? You can call them directly.
                  </p>
                  <a
                    href={`tel:${adminPhone}`}
                    className="focus-ring flex shrink-0 items-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-4 py-2 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600"
                  >
                    <Phone size={16} weight="fill" />
                    Call {adminPhone}
                  </a>
                </div>
              )}
            </>
          )}

        {booking.id_verification_status === "Verified" && booking.payment_status !== "Paid" && (
          <PaymentSection
            token={token}
            totalAmount={booking.total_amount}
            paymentStatus={booking.payment_status}
            rates={rates}
          />
        )}

        {isVerifiedAndActive && (
          <UnlockedSection
            token={token}
            doorCode={booking.room?.door_code ?? null}
            wifiNetworkName={booking.room?.wifi_network_name ?? null}
            wifiPassword={booking.room?.wifi_password ?? null}
            blurred={showArrival}
          />
        )}

        {isVerifiedAndActive && (
          <LaundrySection
            token={token}
            checkIn={booking.check_in}
            checkOut={booking.check_out}
            initialStatus={booking.latestLaundryRequest?.status ?? null}
          />
        )}

        {isVerifiedAndActive && (
          <ExtendStaySection
            token={token}
            checkOut={booking.check_out}
            pendingExtensionCheckOut={booking.pending_extension_check_out}
            pendingExtensionNights={booking.pending_extension_nights}
            pendingExtensionRequestedAt={booking.pending_extension_requested_at}
          />
        )}

        {isVerifiedAndActive &&
          cleaningNotices.map((notice) => (
            <div
              key={notice.id}
              className="flex items-start gap-3 rounded-2xl border border-forest-500/40 bg-forest-500/10 p-5 text-sm text-ink/80 shadow-card"
            >
              <Broom size={20} className="mt-0.5 shrink-0 text-forest-700 dark:text-sage-300" />
              <p>{notice.message}</p>
            </div>
          ))}

        {isVerifiedAndActive &&
          checkoutNotices.map((notice) => (
            <div
              key={notice.id}
              className="flex items-start gap-3 rounded-2xl border border-gold-500/50 bg-gold-500/15 p-5 text-sm text-cocoa shadow-card dark:text-espresso"
            >
              <ClockCountdown size={20} className="mt-0.5 shrink-0 text-gold-700 dark:text-gold-300" />
              <p>{notice.message}</p>
            </div>
          ))}

        {isVerifiedAndActive && (
          <CheckoutSection token={token} isCheckoutDay={isCheckoutDay} />
        )}

        {booking.checked_out_at && (
          <>
            <div className="rounded-2xl border border-forest-500/30 bg-forest-500/10 p-6 shadow-card">
              <p className="font-serif text-h2 text-ink">
                Thanks for staying with Pamhok Homes — hope to host you again!
              </p>
            </div>
            {!booking.hasReview && <ReviewForm token={token} />}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
