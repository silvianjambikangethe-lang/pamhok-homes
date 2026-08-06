import type { Metadata } from "next";
import { ForkKnife, Info, Ticket } from "@phosphor-icons/react/dist/ssr";
import RoomPhoto from "@/components/RoomPhoto";
import PageBanner from "@/components/PageBanner";
import GetDirectionsButton from "@/components/GetDirectionsButton";
import { getContactContent, getNeighborhoodContent } from "@/lib/data";
import { buildDirectionsUrl } from "@/lib/maps";
import type { NeighborhoodItem } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Around the Neighborhood — Pamhok Homes",
  description:
    "Food and recreation near Pamhok Homes, close to Thika Road Mall, Nairobi.",
};

function NeighborhoodGrid({
  items,
  pamhokLat,
  pamhokLng,
}: {
  items: NeighborhoodItem[];
  pamhokLat: number | null;
  pamhokLng: number | null;
}) {
  if (items.length === 0) {
    return (
      <p className="mt-6 text-body-sm text-ink/65">
        Recommendations coming soon — check back shortly.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      {items.map((item, index) => {
        const directionsUrl =
          pamhokLat != null && pamhokLng != null && item.lat != null && item.lng != null
            ? buildDirectionsUrl(pamhokLat, pamhokLng, item.lat, item.lng)
            : null;

        return (
          <div
            key={`${item.name}-${index}`}
            className="rounded-2xl border border-gold-500/20 bg-surface p-5 shadow-card"
          >
            <div className="flex gap-4">
              <RoomPhoto
                url={item.photo_url ?? undefined}
                label={item.name}
                seed={item.name}
                className="h-20 w-20 shrink-0 rounded-xl"
              />
              <div>
                <p className="font-serif text-h3 text-ink">{item.name}</p>
                <p className="mt-1 text-body-sm text-ink/65">{item.detail}</p>
              </div>
            </div>
            {directionsUrl && (
              <div className="mt-4">
                <GetDirectionsButton
                  mapsUrl={directionsUrl}
                  label="Get Directions from Pamhok Homes"
                  needsLocationPrompt={false}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function NeighborhoodPage() {
  const [content, contact] = await Promise.all([
    getNeighborhoodContent(),
    getContactContent(),
  ]);

  return (
    <div>
      <PageBanner
        color="forest"
        eyebrow="Just outside your door"
        title="Around the Neighborhood"
      />

      <div className="container-page mt-8">
        <div className="flex items-start gap-3 rounded-2xl border border-gold-500/30 bg-gold-50 p-4 text-sm text-ink/80 dark:bg-gold-700/15">
          <Info size={20} className="mt-0.5 shrink-0 text-gold-700 dark:text-gold-300" />
          <p>
            Distances and drive times below are approximate — we&apos;ll
            confirm and adjust these once our exact address is finalized.
          </p>
        </div>
      </div>

      <section className="container-page py-12 sm:py-16">
        <div className="flex items-center gap-3">
          <ForkKnife size={26} className="text-terracotta-600" weight="light" />
          <h2 className="font-serif text-h2 text-ink">
            Food
          </h2>
        </div>
        <NeighborhoodGrid
          items={content.food}
          pamhokLat={contact.maps_lat}
          pamhokLng={contact.maps_lng}
        />
      </section>

      <section className="bg-surface py-12 sm:py-16">
        <div className="container-page">
          <div className="flex items-center gap-3">
            <Ticket size={26} className="text-terracotta-600" weight="light" />
            <h2 className="font-serif text-h2 text-ink">
              Recreation
            </h2>
          </div>
          <NeighborhoodGrid
            items={content.recreation}
            pamhokLat={contact.maps_lat}
            pamhokLng={contact.maps_lng}
          />
        </div>
      </section>
    </div>
  );
}
