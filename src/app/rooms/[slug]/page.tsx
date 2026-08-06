import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import RoomPhoto from "@/components/RoomPhoto";
import BookingWidget from "@/components/BookingWidget";
import { getAvailability, getRoomBySlug } from "@/lib/data";
import { getExchangeRates } from "@/lib/currency";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { room } = await getRoomBySlug(slug);
  if (!room) return { title: "Room not found — Pamhok Homes" };
  return {
    title: `${room.name} — Pamhok Homes`,
    description: room.description,
  };
}

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>;
}) {
  const { slug } = await params;
  const { checkIn, checkOut } = await searchParams;
  const { room } = await getRoomBySlug(slug);
  if (!room) notFound();

  const availability = await getAvailability(room.id);
  const rates = await getExchangeRates();

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="grid gap-4 sm:grid-cols-3">
        <RoomPhoto
          url={room.photo_urls?.[0]}
          label={room.photo_labels?.[0] ?? room.name}
          seed={`${room.slug}-0`}
          className="aspect-[4/3] rounded-2xl sm:col-span-2 sm:aspect-[16/10]"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
          <RoomPhoto
            url={room.photo_urls?.[1]}
            label={room.photo_labels?.[1] ?? room.name}
            seed={`${room.slug}-1`}
            className="aspect-square rounded-2xl"
          />
          <RoomPhoto
            url={room.photo_urls?.[2]}
            label={room.photo_labels?.[2] ?? room.name}
            seed={`${room.slug}-2`}
            className="aspect-square rounded-2xl"
          />
        </div>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-5 lg:gap-16">
        <div className="lg:col-span-3">
          <h1 className="font-serif text-h1 text-ink">
            {room.name}
          </h1>
          <div className="mt-2 flex items-center gap-1.5 text-small text-ink/65">
            <UsersThree size={18} />
            Up to {room.max_guests} guests · {room.bed_config}
          </div>
          <p className="mt-6 text-body text-ink/80">
            {room.description}
          </p>

          <div className="mt-8">
            <h2 className="font-serif text-h2 text-ink">
              What this room offers
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {(room.amenities ?? []).map((amenity) => (
                <li
                  key={amenity}
                  className="flex items-center gap-2 text-body-sm text-ink/80"
                >
                  <CheckCircle size={18} weight="fill" className="text-forest-500 dark:text-sage-500" />
                  {amenity}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-24">
            <BookingWidget
              room={room}
              availability={availability}
              rates={rates}
              initialCheckIn={checkIn}
              initialCheckOut={checkOut}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
