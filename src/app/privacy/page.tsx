import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";

export const metadata: Metadata = {
  title: "Privacy Policy — Pamhok Homes",
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

export default function PrivacyPage() {
  return (
    <div>
      <PageBanner color="espresso" eyebrow="Legal" title="Privacy Policy" />

      <div className="container-page max-w-2xl py-12 sm:py-16">
        <p className="text-sm text-ink/55">Last updated: 4 August 2026</p>

        <Section title="What We Collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ink">Contact information:</strong> name,
              email address, phone number
            </li>
            <li>
              <strong className="text-ink">Identity documents:</strong> a copy
              of your government-issued ID, submitted for verification
              purposes only
            </li>
            <li>
              <strong className="text-ink">Booking details:</strong> stay
              dates, room selected, payment amount and method
            </li>
            <li>
              <strong className="text-ink">Communications:</strong> any
              messages sent through the guest portal (e.g. assistance
              requests, laundry requests)
            </li>
          </ul>
        </Section>

        <Section title="Why We Collect It">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              To confirm your identity before granting property access, for
              the safety of all guests and the property
            </li>
            <li>To process your booking and payment</li>
            <li>
              To provide services you request during your stay (laundry,
              assistance)
            </li>
            <li>To communicate with you about your booking</li>
          </ul>
        </Section>

        <Section title="How We Handle Your ID Document">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Your ID is reviewed by our team to verify your identity and is
              never publicly visible or shared beyond what is necessary for
              verification.
            </li>
            <li>
              <strong className="text-ink">
                Once your stay is complete, your ID document is automatically
                and permanently deleted from our systems.
              </strong>{" "}
              We do not retain a copy of your ID after checkout.
            </li>
            <li>Your phone number is also deleted after checkout.</li>
            <li>
              Your name, email, and booking history are retained for our
              business records (accounting, recognizing returning guests, and
              responding to any post-stay issues).
            </li>
          </ul>
        </Section>

        <Section title="Payment Information">
          <p>
            We do not store your full card or payment account details.
            Payments are processed directly through M-Pesa or PayPal, and
            we only retain a payment confirmation reference, not your
            underlying payment credentials.
          </p>
        </Section>

        <Section title="Your Rights">
          <p>Under Kenya&apos;s Data Protection Act, you have the right to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Know what personal data we hold about you</li>
            <li>Request a copy of your data</li>
            <li>Request correction of inaccurate data</li>
            <li>
              Request deletion of your data (note: some information, like
              completed booking records, may be retained for legitimate
              business and tax record-keeping purposes even after a deletion
              request)
            </li>
            <li>Withdraw consent for data processing where applicable</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a
              href="mailto:pamhokhomes@gmail.com"
              className="focus-ring rounded text-terracotta-600 hover:text-terracotta-700"
            >
              pamhokhomes@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="Data Security">
          <p>
            We take reasonable technical measures to protect your personal
            information, including restricting access to verified
            administrators only and using secure, access-controlled storage
            for sensitive documents.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material
            changes will be reflected with an updated &quot;last
            updated&quot; date above.
          </p>
        </Section>
      </div>
    </div>
  );
}
