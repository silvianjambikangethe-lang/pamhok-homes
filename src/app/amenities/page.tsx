import type { Metadata } from "next";
import PageBanner from "@/components/PageBanner";
import { getAmenitiesContent } from "@/lib/data";
import { getAmenityIcon } from "@/lib/amenity-icons";

export const metadata: Metadata = {
  title: "Amenities — Pamhok Homes",
  description:
    "Free WiFi, free parking, a full kitchen, an in-room safe, and dry cleaning — everything you need for a comfortable stay at Pamhok Homes.",
};

export default async function AmenitiesPage() {
  const amenities = await getAmenitiesContent();

  return (
    <div>
      <PageBanner color="espresso" eyebrow="Comfort, covered" title="Amenities" />

      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {amenities.map(({ icon, title, description }) => {
            const Icon = getAmenityIcon(icon);
            return (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-2xl border border-gold-500/20 bg-surface p-7 shadow-card"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-terracotta-50 text-terracotta-600 dark:bg-terracotta-700/30 dark:text-terracotta-300">
                  <Icon size={26} weight="light" />
                </div>
                <h2 className="font-serif text-h3 text-ink">
                  {title}
                </h2>
                <p className="text-body text-ink/65">
                  {description}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
