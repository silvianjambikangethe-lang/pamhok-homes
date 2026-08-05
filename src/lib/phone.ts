// Loose E.164 check — country code + number, digits only once the
// formatting characters are stripped (e.g. +254712345678). wa.me links
// need this same digits-with-country-code shape, so we normalize to it
// here rather than trusting whatever the admin typed.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}
