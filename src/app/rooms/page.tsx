import type { Metadata } from "next";
import Link from "next/link";
import { Info, UsersThree } from "@phosphor-icons/react/dist/ssr";
import RoomPhoto from "@/components/RoomPhoto";
import { getRooms } from "@/lib/data";
import PageBanner from "@/components/PageBanner";

export const metadata: Metadata = {
  title: "Rooms & Availability — Pamhok Homes",
  description:
    "Browse our rooms and check live availability at Pamhok Homes, Nairobi.",
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function RoomsPage() {
  const { rooms, isSample } = await getRooms();

  return (
    <div>
      <PageBanner color="forest" eyebrow="Rooms" title="Find your room" />

      <div className="container-page py-16 sm:py-20">
      <div className="text-center">
        <p className="mx-auto max-w-xl text-body text-ink/80">
          Every room comes with free WiFi, free parking, and full kitchen
          access. Pick your dates on the next page to see live availability.
        </p>
      </div>

      {isSample && (
        <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-gold-500/30 bg-gold-50 p-4 text-sm text-ink/80 dark:bg-gold-700/15">
          <Info size={20} className="mt-0.5 shrink-0 text-gold-700 dark:text-gold-300" />
          <p>
            Showing sample rooms — connect your Supabase project and run{" "}
            <code className="rounded bg-page px-1 py-0.5 text-xs">
              supabase/schema.sql
            </code>{" "}
            to manage real rooms from the admin dashboard.
          </p>
        </div>
      )}

      {!isSample && rooms.length === 0 && (
        <p className="mx-auto mt-12 max-w-xl text-center text-body-sm text-ink/65">
          No rooms are available to book right now — please check back soon.
        </p>
      )}

      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <Link
            key={room.id}
            href={`/rooms/${room.slug}`}
            className="focus-ring group flex flex-col overflow-hidden rounded-2xl border border-gold-500/20 bg-surface shadow-card transition-shadow hover:shadow-warm"
          >
            <RoomPhoto
              url={room.photo_urls?.[0]}
              label={room.photo_labels?.[0] ?? room.name}
              seed={room.slug}
              className="aspect-[4/3] w-full"
            />
            <div className="flex flex-1 flex-col p-6">
              <h2 className="font-serif text-h3 text-ink group-hover:text-terracotta-600">
                {room.name}
              </h2>
              <p className="mt-2 line-clamp-2 text-body-sm text-ink/65">
                {room.description}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-small text-ink/65">
                <UsersThree size={16} />
                Up to {room.max_guests} guests · {room.bed_config}
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-gold-500/20 pt-4">
                <span className="font-serif text-price text-terracotta-600">
                  {formatCurrency(room.price_per_night, room.currency)}
                  <span className="text-small font-normal text-ink/65">
                    {" "}
                    / night
                  </span>
                </span>
                <span className="text-btn text-terracotta-600">
                  View →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
}
