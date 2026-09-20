import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import { getAmenitiesContent } from "@/lib/data";
import { getAmenityIcon } from "@/lib/amenity-icons";
import { SITE, pageTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: pageTitle("Amenities"),
  description:
    "Free WiFi, free parking, a full kitchen, an in-room safe, and dry cleaning — everything you need for a comfortable stay at Pamhok Homes.",
  alternates: { canonical: `${SITE.url}/amenities` },
};

// Admin-editable copy that changes rarely — ISR instead of hitting
// Supabase on every request. An admin edit shows up within 5 minutes
// rather than instantly; unlike Rooms (live availability) or the
// dashboard, that's the right tradeoff here.
export const revalidate = 300;

export default async function AmenitiesPage() {
  const amenities = await getAmenitiesContent();

  return (
    <div>
      <PageBanner color="espressoAmenities" eyebrow="Comfort, covered" title="Amenities" />

      <section className="section-texture bg-surface py-16 sm:py-20">
        <div className="container-page">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {amenities.map(({ icon, title, description }) => {
            const Icon = getAmenityIcon(icon);
            return (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-2xl border border-taupe/20 bg-pk-surface dark:bg-page p-7 shadow-depth transition-all duration-300 hover:-translate-y-0.5 hover:border-pk-caramel dark:hover:border-taupe/20 hover:shadow-depth-hover"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pk-latte text-pk-primary dark:bg-terracotta-700/30 dark:text-terracotta-300">
                  <Icon size={28} weight="regular" />
                </div>
                <h2 className="font-serif text-h3 text-ink">
                  {title}
                </h2>
                <p className="text-body text-ink/80">
                  {description}
                </p>
              </div>
            );
          })}
        </div>
        </div>
      </section>
    </div>
  );
}
