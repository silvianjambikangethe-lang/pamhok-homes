import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, isAfter, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import { CheckCircle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import RoomPhoto from "@/components/RoomPhoto";
import BookingWidget from "@/components/BookingWidget";
import { getAllAvailability, getRoomBySlug, getRooms } from "@/lib/data";
import { getExchangeRates } from "@/lib/currency";
import { SITE, pageTitle } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { room } = await getRoomBySlug(slug);
  if (!room) return { title: pageTitle("Room not found") };

  const title = pageTitle(room.name);
  const canonical = `${SITE.url}/rooms/${room.slug}`;
  // The room's own first photo if it has one uploaded, else the sitewide
  // logo already set as the root layout's openGraph/twitter default — set
  // explicitly here rather than relying on it, since a page-level
  // openGraph/twitter block replaces the parent's rather than merging into
  // it field-by-field.
  const ogImage = room.photo_urls[0] ?? SITE.logoLockupUrl;

  return {
    title,
    description: room.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_US",
      title,
      description: room.description,
      url: canonical,
      images: [{ url: ogImage, alt: room.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: room.description,
      images: [ogImage],
    },
  };
}

export default async function RoomDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    // "Add unit" mode: the slug of the room the guest is building a group
    // booking around, and the ids of units already added to it.
    addTo?: string;
    extras?: string;
  }>;
}) {
  const { slug } = await params;
  const { checkIn, checkOut, addTo, extras } = await searchParams;
  const { room } = await getRoomBySlug(slug);
  if (!room) notFound();

  const [rates, { rooms: allRooms }, allAvailability] = await Promise.all([
    getExchangeRates(),
    getRooms(),
    getAllAvailability(),
  ]);
  // Same view getAvailability(room.id) reads, filtered locally instead of a
  // second round trip.
  const availability = allAvailability.filter((a) => a.room_id === room.id);

  // Other rooms a group (more than 2 guests) can add for the same dates.
  const otherRooms = allRooms
    .filter((r) => r.id !== room.id)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      price_per_night: r.price_per_night,
      currency: r.currency,
      max_guests: r.max_guests,
      bed_config: r.bed_config,
    }));
  const otherRoomIds = new Set(otherRooms.map((r) => r.id));
  const otherAvailability = allAvailability.filter((a) => otherRoomIds.has(a.room_id));

  // Units already added to a group booking (from ?extras=), limited to real
  // rooms and never this page's own room.
  const knownRoomIds = new Set(allRooms.map((r) => r.id));
  const extraIds = [
    ...new Set(
      (extras ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id && id !== room.id && knownRoomIds.has(id)),
    ),
  ].slice(0, 9);

  // "Add unit" mode: the guest came here from another room's checkout to look
  // at this unit. Needs valid future dates and a different, real room.
  const datesQuery = checkIn && checkOut ? `checkIn=${checkIn}&checkOut=${checkOut}` : "";
  const parsedIn = checkIn ? parseISO(checkIn) : null;
  const parsedOut = checkOut ? parseISO(checkOut) : null;
  const datesValid =
    !!parsedIn &&
    !!parsedOut &&
    isValid(parsedIn) &&
    isValid(parsedOut) &&
    isBefore(parsedIn, parsedOut) &&
    !isBefore(parsedIn, startOfDay(new Date()));
  const primary =
    addTo && addTo !== room.slug && datesValid ? (await getRoomBySlug(addTo)).room : null;
  const addMode =
    primary && parsedIn && parsedOut
      ? {
          primary,
          isFree: !availability.some(
            (a) => isBefore(parseISO(a.check_in), parsedOut) && isAfter(parseISO(a.check_out), parsedIn),
          ),
          checkIn: parsedIn,
          checkOut: parsedOut,
          backHref: `/rooms/${primary.slug}?${datesQuery}${
            extraIds.filter((id) => id !== primary.id).length
              ? `&extras=${extraIds.filter((id) => id !== primary.id).join(",")}`
              : ""
          }#book`,
          addHref: `/rooms/${primary.slug}?${datesQuery}&extras=${[
            ...new Set([...extraIds.filter((id) => id !== primary.id), room.id]),
          ].join(",")}#book`,
        }
      : null;

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="grid gap-4 sm:grid-cols-3">
        <RoomPhoto
          url={room.photo_urls?.[0]}
          label={room.photo_labels?.[0] ?? room.name}
          seed={`${room.slug}-0`}
          className="photo-frame aspect-[4/3] rounded-2xl sm:col-span-2 sm:aspect-[16/10]"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1">
          <RoomPhoto
            url={room.photo_urls?.[1]}
            label={room.photo_labels?.[1] ?? room.name}
            seed={`${room.slug}-1`}
            className="photo-frame aspect-square rounded-2xl"
          />
          <RoomPhoto
            url={room.photo_urls?.[2]}
            label={room.photo_labels?.[2] ?? room.name}
            seed={`${room.slug}-2`}
            className="photo-frame aspect-square rounded-2xl"
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
            {addMode ? (
              <div className="rounded-2xl border border-taupe/20 bg-pk-surface p-6 glow-gold sm:p-8 dark:bg-surface">
                <p className="font-serif text-h3 text-ink">Add this unit to your booking</p>
                <p className="mt-2 text-sm text-ink/80">
                  You&apos;re booking {addMode.primary.name} for{" "}
                  {format(addMode.checkIn, "EEE, d MMM")} →{" "}
                  {format(addMode.checkOut, "EEE, d MMM yyyy")}. Add {room.name} to book
                  both together under your name.
                </p>
                {addMode.isFree ? (
                  <Link
                    href={addMode.addHref}
                    className="focus-ring mt-5 flex w-full items-center justify-center rounded-full bg-mocha-500 px-6 py-3.5 text-btn text-mousse transition-colors hover:bg-mocha-600 dark:bg-terracotta-500 dark:text-white dark:hover:bg-terracotta-600"
                  >
                    Add unit
                  </Link>
                ) : (
                  <p className="mt-5 text-sm text-danger">
                    {room.name} isn&apos;t free for those dates, so it can&apos;t be added.
                  </p>
                )}
                <Link
                  href={addMode.backHref}
                  className="focus-ring mt-3 block rounded text-center text-sm font-medium text-terracotta-600 underline hover:text-terracotta-700"
                >
                  Back to my booking without adding
                </Link>
              </div>
            ) : (
              <BookingWidget
                room={room}
                availability={availability}
                otherRooms={otherRooms}
                otherAvailability={otherAvailability}
                initialExtraIds={extraIds}
                rates={rates}
                initialCheckIn={checkIn}
                initialCheckOut={checkOut}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
