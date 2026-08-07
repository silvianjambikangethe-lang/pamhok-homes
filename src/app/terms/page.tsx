import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import { CHECK_IN_TIME, CHECK_OUT_TIME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms & Conditions — Pamhok Homes",
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-h3 text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-body-sm text-ink/80">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div>
      <PageBanner color="espresso" eyebrow="Legal" title="Terms & Conditions" />

      <div className="container-page max-w-2xl py-12 sm:py-16">
        <p className="text-sm text-ink/55">Last updated: 4 August 2026</p>

        <Section title="1. Booking & Payment">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              All bookings are confirmed only once payment has been received
              in full through one of our accepted payment methods: M-Pesa or
              PayPal (which also accepts cards directly, no PayPal account
              required).
            </li>
            <li>
              Prices are listed in Kenyan Shillings (KES); amounts shown in
              other currencies are approximate conversions for reference
              only.
            </li>
            <li>A unique booking reference number is issued upon confirmation.</li>
          </ul>
        </Section>

        <Section title="2. Identity Verification">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Guests are required to submit a valid government-issued ID for
              verification before receiving access details (door code,
              WiFi).
            </li>
            <li>
              ID verification is processed automatically through a
              third-party verification service. In some cases, the host may
              manually review and approve a booking if automated
              verification is inconclusive.
            </li>
            <li>
              Access to the property will not be granted until both payment
              and ID verification are complete.
            </li>
          </ul>
        </Section>

        <Section title="3. Check-In & Check-Out">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Self check-in instructions, including the door code and WiFi
              password, are provided once verification is complete.
            </li>
            <li>
              <strong className="text-ink">Check-in time: {CHECK_IN_TIME}</strong>
            </li>
            <li>
              <strong className="text-ink">Check-out time: {CHECK_OUT_TIME}</strong>
            </li>
            <li>
              Check-out must be confirmed through the guest portal, including
              completion of the check-out checklist (lights off, room
              locked, keys in the keybox).
            </li>
            <li>
              Late check-out may be requested as a stay extension, subject to
              availability and additional payment.
            </li>
          </ul>
        </Section>

        <Section title="4. Stay Extensions">
          <p>
            Guests may request to extend their stay through the guest
            portal, subject to availability. Extensions are confirmed only
            once additional payment is received.
          </p>
        </Section>

        <Section title="5. Additional Services">
          <p>
            Laundry pickup service may be requested through the guest portal
            during an active stay. Laundry is charged separately from your
            room rate and is priced per kilogram: items are weighed at
            pickup, and you will be shown the total price and asked to
            confirm before any payment is taken.
          </p>
        </Section>

        <Section title="6. Cancellations & Refunds">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Cancellations made at least 48 hours before check-in are
              eligible for a full refund.
            </li>
            <li>
              Cancellations made less than 48 hours before check-in are not
              eligible for a refund through the site. In this case, please
              contact the host directly by phone as soon as possible —
              refund or credit at the host&apos;s discretion may still be
              possible depending on the circumstances.
            </li>
            <li>
              All cancellations, whether refundable or not, must be
              confirmed with the host directly by phone so the reservation
              can be removed from the calendar and the room freed up for
              other guests.
            </li>
          </ul>
        </Section>

        <Section title="7. House Rules">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ink">Maximum occupancy: 2 people per booking.</strong>
            </li>
            <li>
              <strong className="text-ink">No parties or events of any kind.</strong>
            </li>
            <li>
              <strong className="text-ink">No pets allowed.</strong>
            </li>
            <li>
              <strong className="text-ink">No smoking inside the property</strong> — this
              includes, but is not limited to, tobacco and bangi (marijuana).
              Any smoking of any substance inside the property is strictly
              prohibited.
            </li>
            <li>
              Guests found in violation of these house rules may have their
              booking cancelled without refund, at the host&apos;s discretion.
            </li>
          </ul>
        </Section>

        <Section title="8. Liability">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Pamhok Homes is not liable for loss, theft, or damage to
              personal belongings during a guest&apos;s stay, except where
              caused by proven negligence on the part of the host.
            </li>
            <li>
              Guests are responsible for any damage caused to the property
              during their stay beyond normal wear and tear.
            </li>
          </ul>
        </Section>

        <Section title="9. Changes to These Terms">
          <p>
            Pamhok Homes may update these Terms from time to time. Continued
            use of the site or a new booking after changes constitutes
            acceptance of the updated Terms.
          </p>
        </Section>
      </div>
    </div>
  );
}
