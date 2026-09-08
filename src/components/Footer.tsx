import Link from "next/link";
import { EnvelopeSimple, MapPin, Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { NAV_LINKS, SITE, whatsappLink } from "@/lib/site";
import { getAdminContactPhone, getSocialLinks } from "@/lib/data";
import { getSocialPlatformMeta } from "@/lib/social-icons";

export default async function Footer() {
  const [socialLinks, adminPhone] = await Promise.all([getSocialLinks(), getAdminContactPhone()]);

  return (
    // Dark mode: no section gets its own accent-color background — the
    // footer drops to the same near-black as the page (a touch darker, to
    // recede) instead of a full Forest fill.
    <footer className="border-t border-taupe/20 bg-forest-700 text-white/80 dark:bg-[#191410]">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="focus-ring inline-block rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE.logoIconUrl} alt={SITE.name} className="h-8 w-8 rounded-md" />
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            {SITE.tagline}. Come stay with us — it&apos;ll feel like home
            before you&apos;ve even unpacked.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-300">
            Explore
          </p>
          <ul className="mt-4 space-y-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="focus-ring rounded text-sm text-white/70 hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-300">
            Get in touch
          </p>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <MapPin size={18} className="mt-0.5 shrink-0" />
              <span>{SITE.address}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone size={18} className="shrink-0" />
              <span>{SITE.phone}</span>
            </li>
            <li className="flex items-center gap-2">
              <EnvelopeSimple size={18} className="shrink-0" />
              <span>{SITE.contactEmail}</span>
            </li>
          </ul>
        </div>

        {adminPhone && (
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-300">
              Chat with us
            </p>
            <p className="mt-4 text-sm text-white/70">
              Quick question about your stay? Message us directly.
            </p>
            <a
              href={whatsappLink(adminPhone, `Hi ${SITE.name}! I have a question about a stay.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full bg-success px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <WhatsappLogo size={18} weight="fill" />
              WhatsApp us
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-taupe/20">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="focus-ring rounded hover:text-white/80">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy" className="focus-ring rounded hover:text-white/80">
              Privacy Policy
            </Link>
          </div>
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-4">
              {socialLinks.map((link) => {
                const meta = getSocialPlatformMeta(link.platform);
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={meta.label}
                    className="focus-ring rounded text-white/50 transition-colors hover:text-white"
                  >
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          )}
          <Link href="/admin/login" className="focus-ring rounded hover:text-white/80">
            Host Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
