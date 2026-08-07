import type { Metadata } from "next";
import { HouseLine, Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { SITE, whatsappLink } from "@/lib/site";
import { getAdminContactPhone } from "@/lib/data";

export const metadata: Metadata = {
  title: "We'll Be Right Back — Pamhok Homes",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const adminPhone = await getAdminContactPhone();

  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border-2 border-terracotta-500 bg-surface p-8 text-center shadow-warm">
        <HouseLine size={40} weight="light" className="mx-auto text-terracotta-600" />
        <h1 className="mt-4 font-serif text-h2 text-ink">We&apos;ll be right back</h1>
        <p className="mt-3 text-body-sm text-ink/80">
          Welcome to Pamhok Homes! We&apos;re briefly offline for essential
          maintenance. To check availability or make a booking right now,
          message us directly — we usually reply within minutes.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {adminPhone && (
            <a
              href={whatsappLink(
                adminPhone,
                "Hi! I'd like to check availability at Pamhok Homes.",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring flex items-center justify-center gap-2 rounded-full bg-success px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <WhatsappLogo size={20} weight="fill" />
              Chat on WhatsApp
            </a>
          )}
          <a
            href={`tel:${SITE.phone}`}
            className="focus-ring flex items-center justify-center gap-2 rounded-full border border-taupe/25 px-5 py-3 text-sm font-semibold text-ink/80 transition-colors hover:border-terracotta-300"
          >
            <Phone size={18} />
            Call {SITE.phone}
          </a>
        </div>

        <p className="mt-6 text-xs text-ink/55">Thank you for your patience.</p>
      </div>
    </div>
  );
}
