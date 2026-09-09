import type { Metadata } from "next";
import { Cormorant, Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import WhatsappFloatButton from "@/components/WhatsappFloatButton";
import { WhatsappVisibilityProvider } from "@/components/WhatsappVisibilityContext";
import { getAdminContactPhone } from "@/lib/data";
import { SITE } from "@/lib/site";

// The typography brief specifies "General Sans" for body text, but it's a
// Fontshare-exclusive font, not actually published on Google Fonts (checked
// against Next.js's font catalog) — Plus Jakarta Sans substitutes as the
// closest same-mood humanist grotesk available via next/font/google.
// Weight 700 dropped from both — audited every actual computed
// font-weight rendered across the site (headings, body text, buttons,
// admin dashboard) and nothing ever uses bold; the type scale in
// tailwind.config.ts tops out at 600 (h3), and no component reaches
// for a bare `font-bold` utility anywhere. One fewer weight file to
// download per family.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const cormorant = Cormorant({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic"],
});

const DEFAULT_DESCRIPTION =
  "Boutique stays near Thika Road Mall, Nairobi. Warm, welcoming rooms with free WiFi, parking, and a personal touch — book directly, no middlemen.";

export const metadata: Metadata = {
  // Resolves every relative canonical/OG/Twitter URL declared on individual
  // pages (via alternates.canonical, openGraph.images, etc.) against the
  // real site origin instead of Next.js's http://localhost default.
  metadataBase: new URL(SITE.url),
  title: `${SITE.name} — A Home Away From Home in Nairobi`,
  description: DEFAULT_DESCRIPTION,
  // Sitewide fallback — any page that doesn't declare its own openGraph/
  // twitter block (about, amenities, neighborhood, contact, rooms listing)
  // inherits this. Room detail pages override with the room's own photo.
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_US",
    title: `${SITE.name} — A Home Away From Home in Nairobi`,
    description: DEFAULT_DESCRIPTION,
    // Real dimensions of the current logo asset (703x700, roughly square) —
    // not the 1200x630 landscape shape most link-preview UIs prefer, which
    // means shares may render smaller/cropped. Worth commissioning a proper
    // landscape OG banner separately; using the real asset's actual size
    // here rather than a fabricated hint.
    images: [{ url: SITE.logoLockupUrl, width: 703, height: 700, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — A Home Away From Home in Nairobi`,
    description: DEFAULT_DESCRIPTION,
    images: [SITE.logoLockupUrl],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminPhone = await getAdminContactPhone();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${plusJakartaSans.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-page text-ink">
        <ThemeProvider>
          <WhatsappVisibilityProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <WhatsappFloatButton phone={adminPhone} />
          </WhatsappVisibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
