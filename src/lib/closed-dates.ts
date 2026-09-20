import { addDays, parseISO, startOfDay } from "date-fns";

export interface ClosedRange {
  start: Date;
  end: Date;
}

// The nights on which EVERY room is taken. The public calendar crosses these
// out. It says nothing about who booked, or whether they have paid: paid and
// pending bookings look identical here, and a night with even one free room is
// not closed.
export function getClosedRanges(
  rooms: { id: string }[],
  availability: { room_id: string; check_in: string; check_out: string }[],
  today: Date = new Date(),
  days = 550,
): ClosedRange[] {
  if (rooms.length === 0) return [];

  const byRoom = new Map<string, { start: number; end: number }[]>();
  for (const a of availability) {
    const list = byRoom.get(a.room_id) ?? [];
    list.push({ start: parseISO(a.check_in).getTime(), end: parseISO(a.check_out).getTime() });
    byRoom.set(a.room_id, list);
  }

  const first = startOfDay(today);
  const ranges: ClosedRange[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(first, i);
    const t = day.getTime();
    const everyRoomTaken = rooms.every((r) =>
      (byRoom.get(r.id) ?? []).some((x) => x.start <= t && t < x.end),
    );
    if (everyRoomTaken) ranges.push({ start: day, end: addDays(day, 1) });
  }
  return ranges;
}
