import Link from "next/link";
import { Star } from "@phosphor-icons/react/dist/ssr";
import PhotoCard from "@/components/PhotoCard";
import Eyebrow from "@/components/Eyebrow";
import { getAmenitiesContent, getHomepageContent } from "@/lib/data";
import { getAmenityIcon } from "@/lib/amenity-icons";

// Real property photos will eventually make this a photo hero. Until
// then, a flat color (not a photo-placeholder gradient) keeps white text
// at reliable contrast everywhere in the banner, in both themes — a
// gradient that dips toward a lighter tone anywhere behind white text
// makes that stretch unreadable. Once an admin sets a hero image, a fixed
// dark overlay guarantees the same contrast regardless of the photo.

const TESTIMONIALS = [
  {
    name: "Amina W.",
    quote:
      "Felt like staying at a friend's place, not a hotel. The check-in was seamless and the room was spotless.",
    rating: 5,
  },
  {
    name: "David K.",
    quote:
      "Perfect base for a TRM trip — five minutes from everything, and the host was incredibly responsive on WhatsApp.",
    rating: 5,
  },
  {
    name: "Grace N.",
    quote:
      "Loved the little touches. Fast WiFi, comfortable bed, and the neighborhood recommendations were spot on.",
    rating: 5,
  },
];

export default async function HomePage() {
  const [content, amenities] = await Promise.all([
    getHomepageContent(),
    getAmenitiesContent(),
  ]);
  const amenityPreview = amenities.slice(0, 5);

  return (
    <div>
      {/* Deep Forest #2A3428 — a distinct, richer tone than the standard
          #3B4A3A used on Neighborhood, unchanged between light/dark per
          master-color-scheme.md (already dark enough for both). */}
      <section
        className="relative overflow-hidden bg-[#2A3428] bg-cover bg-center"
        style={
          content.hero_image_url
            ? {
                backgroundImage: `linear-gradient(rgba(20,22,17,0.55), rgba(20,22,17,0.55)), url(${content.hero_image_url})`,
              }
            : undefined
        }
      >
        <div className="container-page relative flex min-h-[560px] flex-col justify-end gap-6 py-16 sm:min-h-[640px] sm:py-24">
          <Eyebrow className={content.hero_image_url ? "text-ivory" : "text-gold-500"}>
            {content.eyebrow}
          </Eyebrow>
          <h1 className="max-w-2xl font-serif text-display leading-tight text-ivory-dark">
            {content.headline}
          </h1>
          <p className="max-w-xl text-body text-ivory-dark/90">
            {content.subtext}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/rooms"
              className="focus-ring inline-flex items-center justify-center rounded-full bg-terracotta-500 px-7 py-3.5 text-btn text-white shadow-warm transition-colors hover:bg-terracotta-600"
            >
              Check Availability
            </Link>
            <Link
              href="/about"
              className="focus-ring inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-7 py-3.5 text-btn text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              Our Story
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="grid grid-cols-2 gap-4">
            <PhotoCard
              url={content.living_room_image_url}
              label="Living room"
              seed="living"
              className="col-span-2 aspect-[16/10] rounded-2xl shadow-card"
            />
            <PhotoCard
              url={content.bedroom_image_url}
              label="Bedroom"
              seed="bedroom"
              className="aspect-square rounded-2xl shadow-card"
            />
            <PhotoCard
              url={content.kitchen_image_url}
              label="Kitchen"
              seed="kitchen"
              className="aspect-square rounded-2xl shadow-card"
            />
          </div>
          <div>
            <Eyebrow>Welcome</Eyebrow>
            <h2 className="mt-3 font-serif text-h2 text-ink">
              More than a place to sleep
            </h2>
            <p className="mt-5 text-body text-ink/80">
              Pamhok Homes started with a simple idea: guests should feel
              genuinely cared for, not just checked in. Every room is
              thoughtfully furnished, every stay is guided personally, and
              every question gets a real, quick answer — not an automated
              one.
            </p>
            <Link
              href="/about"
              className="focus-ring mt-6 inline-flex items-center gap-2 text-btn text-terracotta-600 hover:text-terracotta-700"
            >
              Read our story →
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-surface py-16 sm:py-20">
        <div className="container-page">
          <div className="flex flex-col gap-2 text-center">
            <Eyebrow>Amenities</Eyebrow>
            <h2 className="font-serif text-h2 text-ink">
              Everything you need, already here
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {amenityPreview.map(({ icon, title }) => {
              const Icon = getAmenityIcon(icon);
              return (
                <div
                  key={title}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-page px-4 py-8 text-center shadow-card"
                >
                  <Icon size={28} weight="light" className="text-terracotta-600" />
                  <span className="text-body-sm font-medium text-ink/80">
                    {title}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/amenities"
              className="focus-ring inline-flex items-center gap-2 text-btn text-terracotta-600 hover:text-terracotta-700"
            >
              See all amenities →
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="flex flex-col gap-2 text-center">
          <Eyebrow>Guest Reviews</Eyebrow>
          <h2 className="font-serif text-h2 text-ink">
            What guests are saying
          </h2>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col gap-4 rounded-2xl border border-gold-500/20 bg-surface p-6 shadow-card"
            >
              <div className="flex gap-1 text-gold-500" aria-hidden="true">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={16} weight="fill" />
                ))}
              </div>
              <blockquote className="font-accent text-quote italic text-ink/80">
                “{t.quote}”
              </blockquote>
              <figcaption className="text-body-sm font-semibold text-ink">
                {t.name}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Dark mode: no section gets its own accent background — this band
          drops to the page background instead of a full Forest fill. */}
      <section className="bg-forest-700 py-16 text-center dark:bg-page sm:py-20">
        <div className="container-page">
          <h2 className="font-serif text-h2 text-white">
            Ready to feel at home?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-body text-white/80">
            Check live availability and book your stay in minutes.
          </p>
          <Link
            href="/rooms"
            className="focus-ring mt-7 inline-flex items-center justify-center rounded-full bg-terracotta-500 px-8 py-3.5 text-btn text-white shadow-warm transition-colors hover:bg-terracotta-600"
          >
            Book Now
          </Link>
        </div>
      </section>
    </div>
  );
}
