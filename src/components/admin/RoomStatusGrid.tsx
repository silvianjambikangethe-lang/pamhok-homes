import RoomStatusCard, { type RoomStatus } from "@/components/admin/RoomStatusCard";

export type { RoomStatus };

// Guest name/phone come straight from the currently-active booking query
// (Confirmed, not yet checked out, today within the stay) - once a guest
// checks out, that booking drops out of the query on its own and the
// phone number is already nulled by the checkout route's privacy
// cleanup, so this clears itself without any extra logic here. Stale
// (checkout time + 30min grace passed, still not confirmed) is flagged
// per-card - see RoomStatusCard.
export default function RoomStatusGrid({ rooms }: { rooms: RoomStatus[] }) {
  return (
    <div>
      <h2 className="font-serif text-h3 text-ink">Room Status</h2>
      <p className="mt-1 text-sm text-ink/65">
        Who&apos;s currently in each room, at a glance.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <RoomStatusCard key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}
