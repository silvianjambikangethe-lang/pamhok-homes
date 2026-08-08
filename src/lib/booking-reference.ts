import { format, parseISO } from "date-fns";

const REFERENCE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Shared by every booking-creation path (online + admin manual entry)
// so the reference format stays identical regardless of how the
// booking was made.
export function generateBookingReference(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += REFERENCE_CHARS[Math.floor(Math.random() * REFERENCE_CHARS.length)];
  }
  return `PMH-${suffix}`;
}

// Shown only on the guest's verification pass. Computed once at booking
// creation and frozen in the row from then on — not derived live from
// the room's current display_order, since that's admin-editable and
// would otherwise let the same booking's reference silently change if
// rooms are ever reordered later.
export function generatePassReference(checkIn: string, roomDisplayOrder: number): string {
  const date = parseISO(checkIn);
  return `REF${format(date, "M")}/${format(date, "d")}-${roomDisplayOrder}-${format(date, "yy")}`;
}
