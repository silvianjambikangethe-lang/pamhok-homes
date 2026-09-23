// Staff clock-in/out times must read the same wherever they're shown —
// the staff device and the admin dashboard were rendering the same
// timestamptz value in two different implicit local timezones (browser
// vs server process), making shifts look "misaligned" even though the
// underlying stored times were correct. Pinning both to the business's
// own timezone (Kenya, no DST) fixes that regardless of where the code
// runs.
const TIME_ZONE = "Africa/Nairobi";

export function formatShiftTime(iso: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatShiftDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
