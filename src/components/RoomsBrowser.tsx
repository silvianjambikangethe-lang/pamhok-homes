"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format, isAfter, isBefore, parseISO } from "date-fns";
import { CalendarBlank, UsersThree } from "@phosphor-icons/react";
import RoomPhoto from "@/components/RoomPhoto";
import { getClosedRanges } from "@/lib/closed-dates";
import BookingCalendar, { type DateRange, type DateSelection } from "@/components/BookingCalendar";
import type { AvailabilityRow, Room } from "@/lib/supabase/types";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Same overlap rule as the server-side check in /api/bookings: a room is
// unavailable for [checkIn, checkOut) if any existing booking/block range
// intersects it at all.
function isRoomAvailable(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  availability: AvailabilityRow[],
) {
  return !availability.some((a) => {
    if (a.room_id !== roomId) return false;
    return isBefore(parseISO(a.check_in), checkOut) && isAfter(parseISO(a.check_out), checkIn);
  });
}

export default function RoomsBrowser({
  rooms,
  availability,
}: {
  rooms: Room[];
  availability: AvailabilityRow[];
}) {
  const [selection, setSelection] = useState<DateSelection>({
    checkIn: null,
    checkOut: null,
  });
  const datesSelected = Boolean(selection.checkIn && selection.checkOut);

  // A night shows as closed (crossed out) only when EVERY room is taken that
  // night. Nothing about who booked, or whether they have paid, is shown.
  const closedRanges = useMemo<DateRange[]>(
    () => getClosedRanges(rooms, availability),
    [rooms, availability],
  );

  const availableRooms = useMemo(() => {
    if (!selection.checkIn || !selection.checkOut) return [];
    return rooms.filter((room) =>
      isRoomAvailable(room.id, selection.checkIn!, selection.checkOut!, availability),
    );
  }, [rooms, availability, selection]);

  const nights =
    selection.checkIn && selection.checkOut
      ? differenceInCalendarDays(selection.checkOut, selection.checkIn)
      : 0;

  const dateQuery = datesSelected
    ? `?checkIn=${format(selection.checkIn!, "yyyy-MM-dd")}&checkOut=${format(selection.checkOut!, "yyyy-MM-dd")}`
    : "";

  return (
    <>
      <div className="mx-auto max-w-md rounded-2xl border border-taupe/20 bg-pk-surface p-6 glow-gold dark:bg-surface">
        <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-ink/80">
          <CalendarBlank size={18} />
          Select your dates to see available rooms
        </p>
        <BookingCalendar bookedRanges={closedRanges} selection={selection} onChange={setSelection} />
      </div>

      {!datesSelected && (
        <p className="mx-auto mt-10 max-w-xl text-center text-body-sm text-ink/65">
          Pick a check-in and check-out date above to see which rooms are open.
        </p>
      )}

      {datesSelected && availableRooms.length === 0 && (
        <div className="mx-auto mt-10 max-w-xl text-center">
          <p className="text-body-sm text-ink/65">
            No rooms are open from {format(selection.checkIn!, "d MMM")} to{" "}
            {format(selection.checkOut!, "d MMM yyyy")}. Try different dates, or
            message us on WhatsApp — we may be able to help.
          </p>
          <button
            type="button"
            onClick={() => setSelection({ checkIn: null, checkOut: null })}
            className="focus-ring mt-4 rounded-full border border-taupe/25 px-5 py-2 text-sm font-semibold text-ink/80 hover:border-terracotta-300"
          >
            Clear dates and try again
          </button>
        </div>
      )}

      {datesSelected && availableRooms.length > 0 && (
        <div className="mt-12">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-serif text-h2 text-ink">
              {availableRooms.length} room{availableRooms.length > 1 ? "s" : ""} open
            </h2>
            <p className="text-body-sm text-ink/80">
              {format(selection.checkIn!, "EEE d MMM")} to{" "}
              {format(selection.checkOut!, "EEE d MMM yyyy")} · {nights} night
              {nights > 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-pk-sunken p-6 sm:p-8 dark:bg-transparent dark:p-0 dark:sm:p-0">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {availableRooms.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.slug}${dateQuery}`}
              className="focus-ring group flex cursor-default flex-col overflow-hidden rounded-2xl border card-pop bg-pk-surface dark:bg-surface transition-all duration-300 active:-translate-y-0.5 md:cursor-pointer md:hover:-translate-y-1"
            >
              <RoomPhoto
                url={room.photo_urls?.[0]}
                label={room.photo_labels?.[0] ?? room.name}
                seed={room.slug}
                className="photo-frame aspect-[4/3] w-full transition-transform duration-300 group-active:scale-105 md:group-hover:scale-105"
              />
              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-serif text-h3 text-ink group-active:text-terracotta-600 md:group-hover:text-terracotta-600">
                  {room.name}
                </h2>
                <p className="mt-2 line-clamp-2 text-body-sm text-ink/80">
                  {room.description}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-small text-ink/80">
                  <UsersThree size={16} />
                  Up to {room.max_guests} guests · {room.bed_config}
                </div>
                <div className="mt-4 border-t border-taupe/20 pt-4">
                  <span className="font-serif text-price text-terracotta-600 dark:text-terracotta-600">
                    {formatCurrency(room.price_per_night, room.currency)}
                    <span className="whitespace-nowrap text-small font-normal text-ink/65">
                      {" "}
                      / night
                    </span>
                  </span>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-small text-ink/80">
                      {formatCurrency(room.price_per_night * nights, room.currency)} for{" "}
                      {nights} night{nights > 1 ? "s" : ""}
                    </p>
                    <span className="shrink-0 rounded-full bg-mocha-500 px-4 py-2 text-btn text-mousse transition-colors group-hover:bg-mocha-600 dark:bg-terracotta-500 dark:text-white">
                      View room
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          </div>
          </div>
        </div>
      )}
    </>
  );
}
