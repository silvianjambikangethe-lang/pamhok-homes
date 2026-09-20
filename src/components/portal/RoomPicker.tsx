"use client";

// One of the rooms a guest booked together. `token` is that room's own portal
// link id; `ready` is false until that room is confirmed and ID-verified.
export interface RequestRoom {
  token: string;
  name: string;
  ready: boolean;
}

// "Which room is this for?" Lists ONLY the rooms in the guest's own group
// booking (the portal builds the list from the guest's own bookings), and
// renders nothing for a single-room booking.
export default function RoomPicker({
  rooms,
  value,
  onChange,
}: {
  rooms: RequestRoom[];
  value: string;
  onChange: (token: string) => void;
}) {
  if (rooms.length < 2) return null;

  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink/80">Which room is this for?</legend>
      <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Room">
        {rooms.map((r) => {
          const selected = r.token === value;
          return (
            <button
              key={r.token}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!r.ready}
              onClick={() => onChange(r.token)}
              className={`focus-ring rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-terracotta-500 bg-terracotta-500 text-white"
                  : "border-taupe/25 bg-page text-ink/80"
              }`}
            >
              {r.name}
              {!r.ready && " (not ready)"}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
