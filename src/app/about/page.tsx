import type { Metadata } from "next";
import Link from "next/link";
import PhotoCard from "@/components/PhotoCard";
import PageBanner from "@/components/PageBanner";
import { getAboutContent } from "@/lib/data";

export const metadata: Metadata = {
  title: "About Us — Pamhok Homes",
  description:
    "The story behind Pamhok Homes — a boutique, host-run stay near Thika Road Mall, Nairobi.",
};

// Admin-editable copy that changes rarely — ISR instead of hitting
// Supabase on every request. See amenities/page.tsx for the same note.
export const revalidate = 300;

export default async function AboutPage() {
  const content = await getAboutContent();
  const paragraphs = content.body.split(/\n{2,}/).filter(Boolean);

  return (
    <div>
      <PageBanner color="cocoa" eyebrow="Our Story" title="A home we're proud to share" />

      <section className="bg-surface py-16 sm:py-20">
        <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <div className="rounded-2xl border-[1.5px] border-taupe bg-page px-7 py-8 shadow-frame">
              <div className="space-y-4 text-body text-ink/80">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
            <Link
              href="/rooms"
              className="focus-ring mt-8 inline-flex items-center justify-center rounded-full bg-mocha-500 dark:bg-terracotta-500 px-7 py-3.5 text-btn text-mousse dark:text-white shadow-card transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600"
            >
              See Our Rooms
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PhotoCard
              url={content.image_url}
              label="The host welcoming a guest"
              seed="about-1"
              className="col-span-2 aspect-[16/10] rounded-2xl shadow-card"
            />
            <PhotoCard
              url={content.coffee_corner_image_url}
              label="Morning coffee corner"
              seed="about-2"
              className="aspect-square rounded-2xl shadow-card"
            />
            <PhotoCard
              url={content.reading_nook_image_url}
              label="Quiet reading nook"
              seed="about-3"
              className="aspect-square rounded-2xl shadow-card"
            />
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container-page grid gap-8 text-center sm:grid-cols-3">
          <div>
            <p className="font-serif text-h1 text-terracotta-600">
              Personal
            </p>
            <p className="mt-2 text-body-sm text-ink/65">
              Direct WhatsApp access to your host, always.
            </p>
          </div>
          <div>
            <p className="font-serif text-h1 text-terracotta-600">
              Central
            </p>
            <p className="mt-2 text-body-sm text-ink/65">
              Minutes from Thika Road Mall and Nairobi&apos;s main routes.
            </p>
          </div>
          <div>
            <p className="font-serif text-h1 text-terracotta-600">
              Cared for
            </p>
            <p className="mt-2 text-body-sm text-ink/65">
              Every room prepared and checked before you arrive.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
