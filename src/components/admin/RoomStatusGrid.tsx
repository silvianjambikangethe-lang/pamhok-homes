import { format } from "date-fns";
import { Phone, User } from "@phosphor-icons/react/dist/ssr";
import { CHECK_OUT_TIME } from "@/lib/site";

export type RoomStatus = {
  id: string;
  name: string;
  guestName: string | null;
  guestPhone: string | null;
  checkOut: string | null;
};

// Guest name/phone come straight from the currently-active booking query
// (Confirmed, not yet checked out, today within the stay) - once a guest
// checks out, that booking drops out of the query on its own and the
// phone number is already nulled by the checkout route's privacy
// cleanup, so this clears itself without any extra logic here.
export default function RoomStatusGrid({ rooms }: { rooms: RoomStatus[] }) {
  return (
    <div>
      <h2 className="font-serif text-h3 text-ink">Room Status</h2>
      <p className="mt-1 text-sm text-ink/65">
        Who&apos;s currently in each room, at a glance.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className={`rounded-2xl border p-5 shadow-card ${
              room.guestName
                ? "border-terracotta-500/40 bg-surface"
                : "border-taupe/20 bg-page"
            }`}
          >
            <p className="font-serif text-h3 text-ink">{room.name}</p>
            {room.guestName ? (
              <div className="mt-3 space-y-1.5 text-sm">
                <p className="flex items-center gap-2 text-ink/80">
                  <User size={16} className="shrink-0 text-terracotta-600" />
                  {room.guestName}
                </p>
                {room.guestPhone && (
                  <a
                    href={`tel:${room.guestPhone}`}
                    className="focus-ring flex items-center gap-2 rounded text-ink/80 hover:text-terracotta-600"
                  >
                    <Phone size={16} className="shrink-0 text-terracotta-600" />
                    {room.guestPhone}
                  </a>
                )}
                {room.checkOut && (
                  <p className="text-xs text-ink/55">
                    Checkout {format(new Date(room.checkOut), "d MMM")}, {CHECK_OUT_TIME}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink/55">Available</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
