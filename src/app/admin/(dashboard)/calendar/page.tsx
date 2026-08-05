import { addDays, eachDayOfInterval, format, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DAYS_AHEAD = 45;

export default async function AdminCalendarPage() {
  const supabase = await createServerSupabaseClient();

  const today = startOfDay(new Date());
  const rangeEnd = addDays(today, DAYS_AHEAD);
  const days = eachDayOfInterval({ start: today, end: rangeEnd });

  const [{ data: rooms }, { data: bookings }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("bookings")
      .select("room_id, check_in, check_out, booking_status, guest:guests(full_name)")
      .in("booking_status", ["Confirmed", "Blocked"])
      .lte("check_in", format(rangeEnd, "yyyy-MM-dd"))
      .gte("check_out", format(today, "yyyy-MM-dd")),
  ]);

  function cellStatus(roomId: string, day: Date) {
    const match = (bookings ?? []).find(
      (b) =>
        b.room_id === roomId &&
        isWithinInterval(day, {
          start: parseISO(b.check_in),
          end: addDays(parseISO(b.check_out), -1),
        }),
    );
    if (!match) return { status: "available" as const, label: null };
    if (match.booking_status === "Blocked") return { status: "blocked" as const, label: "Blocked" };
    const guestName =
      (match as unknown as { guest?: { full_name?: string } }).guest?.full_name ?? "Guest";
    return { status: "booked" as const, label: guestName };
  }

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Calendar</h1>
      <p className="mt-1 text-sm text-ink/80">
        Next {DAYS_AHEAD} days across all rooms — booked, blocked, and available.
      </p>

      <div className="mt-6 flex gap-4 text-xs text-ink/80">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-page ring-1 ring-gold-500/25" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-terracotta-500" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-espresso-500" /> Blocked
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-gold-500/20 bg-surface shadow-card">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-semibold text-ink/80">
                Room
              </th>
              {days.map((day) => (
                <th
                  key={day.toISOString()}
                  className="min-w-[32px] px-1 py-2 text-center font-medium text-ink/65"
                >
                  {format(day, "d")}
                  <br />
                  <span className="text-[10px]">{format(day, "EEE").slice(0, 1)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rooms ?? []).map((room) => (
              <tr key={room.id} className="border-t border-gold-500/10">
                <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium text-ink/80 whitespace-nowrap">
                  {room.name}
                </td>
                {days.map((day) => {
                  const cell = cellStatus(room.id, day);
                  const color =
                    cell.status === "booked"
                      ? "bg-terracotta-500"
                      : cell.status === "blocked"
                        ? "bg-espresso-500"
                        : "bg-page";
                  return (
                    <td key={day.toISOString()} className="p-0.5">
                      <div
                        title={cell.label ?? "Available"}
                        className={`h-6 w-full rounded-sm ${color} ${cell.status === "available" ? "ring-1 ring-gold-500/20" : ""}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {(rooms ?? []).length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="px-4 py-8 text-center text-ink/65">
                  No rooms yet — add one in Supabase to see it here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
