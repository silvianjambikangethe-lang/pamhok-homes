import type { Metadata } from "next";
import { Prohibit, Phone } from "@phosphor-icons/react/dist/ssr";
import { SITE, pageTitle } from "@/lib/site";

// Reached only via a client-side redirect from BookingWidget when
// /api/bookings returns 403 (a blocked guest name) — see
// src/lib/guest-blocklist.ts. Deliberately no WhatsApp "chat to book"
// CTA like maintenance/page.tsx has: that would hand a blocked guest an
// easy path straight back to a booking, defeating the point of the
// blocklist. A phone number is enough for a genuine mistaken-block
// dispute, and staff can decide from there with full context.
export const metadata: Metadata = {
  title: pageTitle("Booking Unavailable"),
  robots: { index: false, follow: false },
};

export default function BookingBlockedPage() {
  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border-2 border-danger/60 bg-surface p-8 text-center shadow-warm">
        <Prohibit size={40} weight="light" className="mx-auto text-danger" />
        <h1 className="mt-4 font-serif text-h2 text-ink">We can&apos;t complete this booking</h1>
        <p className="mt-3 text-body-sm text-ink/80">
          {SITE.name} is unable to accept a booking under the details provided. If you believe
          this is a mistake, please call us directly.
        </p>

        <div className="mt-6">
          <a
            href={`tel:${SITE.phone}`}
            className="focus-ring flex items-center justify-center gap-2 rounded-full border border-taupe/25 px-5 py-3 text-sm font-semibold text-ink/80 transition-colors hover:border-terracotta-300"
          >
            <Phone size={18} />
            Call {SITE.phone}
          </a>
        </div>
      </div>
    </div>
  );
}
