import { format, formatDistanceStrict, parseISO } from "date-fns";
import { Clock, UserCircle } from "@phosphor-icons/react/dist/ssr";

type ShiftRow = {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  staff_member: { name: string } | null;
};

export default function StaffShiftBoard({
  clockedIn,
  shifts,
}: {
  clockedIn: ShiftRow[];
  shifts: ShiftRow[];
}) {
  return (
    <div className="mt-6 space-y-6">
      <div>
        <h2 className="font-serif text-lg font-semibold text-ink">Currently Clocked In</h2>
        {clockedIn.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-taupe/20 bg-surface p-5 text-sm text-ink/65 shadow-card">
            No one is clocked in right now.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clockedIn.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-forest-500/30 bg-forest-500/10 p-4 shadow-card"
              >
                <UserCircle size={28} weight="light" className="text-forest-700 dark:text-sage-300" />
                <div>
                  <p className="font-semibold text-ink">{s.staff_member?.name ?? "Unknown"}</p>
                  <p className="text-xs text-ink/65">
                    Since {format(parseISO(s.clock_in_at), "h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-serif text-lg font-semibold text-ink">Recent Shifts</h2>
        {shifts.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-taupe/20 bg-surface p-5 text-sm text-ink/65 shadow-card">
            No shifts logged yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-taupe/20 bg-surface shadow-card">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-taupe/20 text-xs uppercase tracking-wide text-ink/55">
                  <th className="px-4 py-3 font-medium">Worker</th>
                  <th className="px-4 py-3 font-medium">Clock In</th>
                  <th className="px-4 py-3 font-medium">Clock Out</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id} className="border-b border-taupe/10 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {s.staff_member?.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-ink/80">
                      {format(parseISO(s.clock_in_at), "d MMM, h:mm a")}
                    </td>
                    <td className="px-4 py-3 text-ink/80">
                      {s.clock_out_at ? (
                        format(parseISO(s.clock_out_at), "d MMM, h:mm a")
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Clock size={14} weight="fill" /> In progress
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink/65">
                      {s.clock_out_at
                        ? formatDistanceStrict(parseISO(s.clock_in_at), parseISO(s.clock_out_at))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
