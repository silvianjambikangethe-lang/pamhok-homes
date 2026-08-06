"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { CalendarBlank, UsersThree } from "@phosphor-icons/react";
import RoomPhoto from "@/components/RoomPhoto";
import BookingCalendar, { type DateSelection } from "@/components/BookingCalendar";
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

  const availableRooms = useMemo(() => {
    if (!selection.checkIn || !selection.checkOut) return [];
    return rooms.filter((room) =>
      isRoomAvailable(room.id, selection.checkIn!, selection.checkOut!, availability),
    );
  }, [rooms, availability, selection]);

  const dateQuery = datesSelected
    ? `?checkIn=${format(selection.checkIn!, "yyyy-MM-dd")}&checkOut=${format(selection.checkOut!, "yyyy-MM-dd")}`
    : "";

  return (
    <>
      <div className="mx-auto max-w-md rounded-2xl border border-gold-500/20 bg-surface p-6 shadow-card">
        <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-ink/80">
          <CalendarBlank size={18} />
          Select your dates to see available rooms
        </p>
        <BookingCalendar bookedRanges={[]} selection={selection} onChange={setSelection} />
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
            className="focus-ring mt-4 rounded-full border border-gold-500/25 px-5 py-2 text-sm font-semibold text-ink/80 hover:border-terracotta-300"
          >
            Clear dates and try again
          </button>
        </div>
      )}

      {datesSelected && availableRooms.length > 0 && (
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {availableRooms.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.slug}${dateQuery}`}
              className="focus-ring group flex cursor-default flex-col overflow-hidden rounded-2xl border border-gold-500/20 bg-surface shadow-card transition-all duration-300 active:-translate-y-1 active:shadow-warm md:cursor-pointer md:hover:-translate-y-1 md:hover:shadow-warm"
            >
              <RoomPhoto
                url={room.photo_urls?.[0]}
                label={room.photo_labels?.[0] ?? room.name}
                seed={room.slug}
                className="aspect-[4/3] w-full transition-transform duration-300 group-active:scale-105 md:group-hover:scale-105"
              />
              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-serif text-h3 text-ink group-active:text-terracotta-600 md:group-hover:text-terracotta-600">
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
      )}
    </>
  );
}
