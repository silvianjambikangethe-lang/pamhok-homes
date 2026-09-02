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

export const metadata: Metadata = {
  title: `${SITE.name} — A Home Away From Home in Nairobi`,
  description:
    "Boutique stays near Thika Road Mall, Nairobi. Warm, welcoming rooms with free WiFi, parking, and a personal touch — book directly, no middlemen.",
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
