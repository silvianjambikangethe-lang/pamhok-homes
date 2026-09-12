import type { Metadata } from "next";
import { EnvelopeSimple, MapPin, Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { SITE, pageTitle, whatsappLink } from "@/lib/site";
import { getAdminContactPhone, getContactContent } from "@/lib/data";
import ContactForm from "@/components/ContactForm";
import PageBanner from "@/components/PageBanner";
import GetDirectionsButton from "@/components/GetDirectionsButton";

export const metadata: Metadata = {
  title: pageTitle("Contact & Location"),
  description:
    "Get in touch with Pamhok Homes — WhatsApp, phone, email, or send us a message directly.",
  alternates: { canonical: `${SITE.url}/contact` },
};

// Was missing entirely — this page (address, maps link, directions
// video, admin WhatsApp number) had no revalidate export at all, and
// getContactContent()/getAdminContactPhone() use the plain (non-cookie)
// Supabase client, which gives Next.js no reason to treat this route as
// dynamic. Net effect: the page was fully static from build time and
// silently never picked up ANY admin edit here (a new WhatsApp number,
// an updated maps link, the directions video added this session) until
// the next deployment — confirmed live: the directions video admin
// uploaded was invisible on production despite existing in the
// database. Matches About/Amenities' existing revalidate = 300.
export const revalidate = 300;

export default async function ContactPage() {
  const [content, adminPhone] = await Promise.all([getContactContent(), getAdminContactPhone()]);

  return (
    <div>
      <PageBanner color="cocoa" eyebrow="Get in touch" title="We're here for you" />

      <div className="container-page py-16 sm:py-20">
      <div className="text-center">
        <p className="mx-auto max-w-xl text-body text-ink/80">
          {content.intro_line}
        </p>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-5 lg:gap-12">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-taupe/20 bg-surface p-7 shadow-card">
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
                href={whatsappLink(adminPhone, `Hi ${SITE.name}! I have a question.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring mt-6 flex items-center justify-center gap-2 rounded-full bg-mocha-500 px-5 py-3 text-sm font-semibold text-mousse transition-colors hover:bg-mocha-600 dark:bg-terracotta-500 dark:text-white dark:hover:bg-terracotta-600"
              >
                <WhatsappLogo size={20} weight="fill" />
                Chat on WhatsApp
              </a>
            )}
          </div>

          {content.maps_url && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-taupe/20 shadow-card">
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-surface p-6 text-center text-ink/65">
                <MapPin size={32} weight="light" className="text-terracotta-600" />
                <p className="max-w-[220px] text-sm">
                  Open the pinned location in Google Maps for directions.
                </p>
                <GetDirectionsButton mapsUrl={content.maps_url} />
              </div>
            </div>
          )}

          {content.directions_video_url && (
            <div className="mt-6 rounded-2xl border border-taupe/20 bg-surface p-5 text-center shadow-card">
              <p className="text-sm font-medium text-ink/80">
                Watch: driving directions to {SITE.name}
              </p>
              <video
                src={content.directions_video_url}
                controls
                preload="metadata"
                className="mx-auto mt-3 aspect-[9/16] w-full max-w-[220px] rounded-xl bg-black"
              />
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
