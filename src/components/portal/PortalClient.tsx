import { format, isPast, parseISO, startOfDay } from "date-fns";
import { CalendarBlank, Info, Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import type { PortalBooking } from "@/lib/portal";
import type { DisplayCurrency } from "@/lib/currency";
import { whatsappLink } from "@/lib/site";
import PageBanner from "@/components/PageBanner";
import PaymentSection from "@/components/portal/PaymentSection";
import IdUploadForm from "@/components/portal/IdUploadForm";
import UnlockedSection from "@/components/portal/UnlockedSection";
import LaundrySection from "@/components/portal/LaundrySection";
import ExtendStaySection from "@/components/portal/ExtendStaySection";
import CheckoutSection from "@/components/portal/CheckoutSection";
import ReviewForm from "@/components/portal/ReviewForm";
import VerificationPassSection from "@/components/portal/VerificationPassSection";
import { firstNameLastInitial } from "@/lib/guest-display-name";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-gold-500 text-espresso",
  Paid: "bg-forest-500 text-ivory-dark dark:bg-sage-500 dark:text-espresso",
  Failed: "bg-danger text-white",
};

export default function PortalClient({
  booking,
  token,
  rates,
  qrDataUrl,
  adminPhone,
}: {
  booking: PortalBooking;
  token: string;
  rates: Record<DisplayCurrency, number>;
  qrDataUrl: string | null;
  adminPhone: string | null;
}) {
  const checkOutDate = startOfDay(parseISO(booking.check_out));
  const isCheckoutDay = isPast(checkOutDate) || format(checkOutDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const isPassReady =
    booking.payment_status === "Paid" && booking.id_verification_status === "Verified";
  const isVerifiedAndActive = isPassReady && !booking.checked_out_at;

  return (
    <div>
      <PageBanner
        color="sage"
        eyebrow="Your Stay"
        title={booking.room?.name ?? "Pamhok Homes"}
      />

      <div className="container-page max-w-3xl py-12 sm:py-16">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-gold-500/20 bg-surface p-6 shadow-card">
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

      {adminPhone && (
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
        <VerificationPassSection
          isReady={isPassReady}
          guestDisplayName={firstNameLastInitial(booking.guest?.full_name)}
          roomName={booking.room?.name ?? "Pamhok Homes"}
          checkIn={booking.check_in}
          checkOut={booking.check_out}
          bookingReference={booking.booking_reference}
          qrDataUrl={isPassReady ? qrDataUrl : null}
        />

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
              <div className="flex items-start gap-3 rounded-2xl border border-gold-500/40 bg-gold-500/15 p-5 text-sm text-espresso shadow-card dark:bg-gold-500/20">
                <Info size={20} className="mt-0.5 shrink-0 text-espresso" />
                <div>
                  <p className="font-semibold text-espresso">Your ID is under review</p>
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
                    className="focus-ring flex shrink-0 items-center gap-2 rounded-full bg-terracotta-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600"
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

        {isVerifiedAndActive && <ExtendStaySection token={token} checkOut={booking.check_out} />}

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
