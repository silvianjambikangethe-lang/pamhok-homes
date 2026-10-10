// Shared guest-contact-info validation, used by both the public booking
// form and the admin's manual/walk-in booking form so the two accept the
// same input shape.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

export type OccupantInput = { name: string; email?: string; phone?: string };

// A group booking (several rooms, one request) can name a different person
// actually staying in an extra room — e.g. a friend taking the next room
// over. This shape-checks that optional "roomId -> occupant" map, used by
// both the public and admin manual booking routes, and returns null if
// anything about it looks wrong (caller treats that as a 400). A room with
// nothing filled in is simply left out of the result — this is opt-in per
// room, not required for every extra room in the group.
export function parseExtraRoomGuests(
  value: unknown,
  extraRoomIds: string[],
): Record<string, OccupantInput> | null {
  if (typeof value === "undefined") return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const result: Record<string, OccupantInput> = {};
  for (const [roomId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!extraRoomIds.includes(roomId)) return null;
    if (!raw || typeof raw !== "object") return null;

    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const email = typeof r.email === "string" ? r.email.trim() : "";
    const phone = typeof r.phone === "string" ? r.phone.trim() : "";

    if (!name && !email && !phone) continue;
    if (!name || name.length > 100) return null;
    if (email && (email.length > 254 || !EMAIL_RE.test(email))) return null;
    if (phone && !PHONE_RE.test(phone)) return null;

    result[roomId] = { name, email: email || undefined, phone: phone || undefined };
  }
  return result;
}
