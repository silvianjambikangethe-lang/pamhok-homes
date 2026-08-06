import type { Metadata } from "next";
import { EnvelopeSimple, MapPin, Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { SITE, whatsappLink } from "@/lib/site";
import { getAdminContactPhone, getContactContent } from "@/lib/data";
import ContactForm from "@/components/ContactForm";
import PageBanner from "@/components/PageBanner";
import GetDirectionsButton from "@/components/GetDirectionsButton";

export const metadata: Metadata = {
  title: "Contact & Location — Pamhok Homes",
  description:
    "Get in touch with Pamhok Homes — WhatsApp, phone, email, or send us a message directly.",
};

export default async function ContactPage() {
  const [content, adminPhone] = await Promise.all([getContactContent(), getAdminContactPhone()]);

  return (
    <div>
      <PageBanner color="espresso" eyebrow="Get in touch" title="We're here for you" />

      <div className="container-page py-16 sm:py-20">
      <div className="text-center">
        <p className="mx-auto max-w-xl text-body text-ink/80">
          {content.intro_line}
        </p>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-5 lg:gap-12">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-gold-500/20 bg-surface p-7 shadow-card">
            <ul className="space-y-5 text-sm text-ink/80">
              <li className="flex items-start gap-3">
                <MapPin size={20} className="mt-0.5 shrink-0 text-terracotta-600" />
                <span>
                  {content.address_text}
                  <br />
                  <span className="text-xs text-ink/65">
                    {content.address_note}
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={20} className="shrink-0 text-terracotta-600" />
                {SITE.phone}
              </li>
              <li className="flex items-center gap-3">
                <EnvelopeSimple size={20} className="shrink-0 text-terracotta-600" />
                {SITE.contactEmail}
              </li>
            </ul>

            {adminPhone && (
              <a
                href={whatsappLink(adminPhone, "Hi Pamhok Homes! I have a question.")}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring mt-6 flex items-center justify-center gap-2 rounded-full bg-success px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <WhatsappLogo size={20} weight="fill" />
                Chat on WhatsApp
              </a>
            )}
          </div>

          {content.maps_url && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-gold-500/20 shadow-card">
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-surface p-6 text-center text-ink/65">
                <MapPin size={32} weight="light" className="text-terracotta-600" />
                <p className="max-w-[220px] text-sm">
                  Open the pinned location in Google Maps for directions.
                </p>
                <GetDirectionsButton mapsUrl={content.maps_url} />
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <ContactForm />
        </div>
      </div>
      </div>
    </div>
  );
}
