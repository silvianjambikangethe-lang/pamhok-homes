import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { SealCheck, Warning } from "@phosphor-icons/react/dist/ssr";
import PageBanner from "@/components/PageBanner";
import { getBookingByToken } from "@/lib/portal";
import { firstNameLastInitial } from "@/lib/guest-display-name";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Verify a Guest — Pamhok Homes",
  robots: { index: false, follow: false },
};

export default async function VerifyPassPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const booking = await getBookingByToken(token);

  const isValid =
    !!booking &&
    booking.payment_status === "Paid" &&
    booking.id_verification_status === "Verified";

  return (
    <div>
      <PageBanner color="sage" eyebrow="Guest Verification" title="Pamhok Homes" />

      <div className="container-page max-w-md py-12 sm:py-16">
        {isValid ? (
          <div className="rounded-2xl border-2 border-terracotta-500 bg-surface p-6 shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE.logoIconUrl} alt={SITE.name} className="h-8 w-8 rounded-md" />
            <div className="mt-3 flex items-center gap-2">
              <SealCheck size={24} weight="fill" className="text-success" />
              <h1 className="font-serif text-h3 text-ink">Verified Guest</h1>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink/55">Guest</dt>
                <dd className="font-semibold text-ink">
                  {firstNameLastInitial(booking.guest?.full_name)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink/55">Room</dt>
                <dd className="font-semibold text-ink">{booking.room?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink/55">Stay dates</dt>
                <dd className="font-semibold text-ink">
                  {format(parseISO(booking.check_in), "d MMM")} →{" "}
                  {format(parseISO(booking.check_out), "d MMM yyyy")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink/55">Reference</dt>
                <dd className="font-mono font-semibold text-ink">
                  {booking.booking_reference ?? "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-gold-500/20 pt-4 text-sm text-ink/80">
              Confirm with the host: {SITE.phone} · {SITE.contactEmail}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-gold-500/25 bg-page p-5 text-sm text-ink/80 shadow-card">
            <Warning size={20} className="mt-0.5 shrink-0 text-danger" />
            <p>This pass isn&apos;t valid, or hasn&apos;t been activated yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
