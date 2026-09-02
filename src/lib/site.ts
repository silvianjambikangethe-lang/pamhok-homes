export const SITE = {
  name: "Pamhok Homes",
  tagline: "A home away from home, near Thika Road Mall",
  city: "Nairobi, Kenya",
  // Short landmark-based address shown in the footer and email templates —
  // deliberately not full street address (no numbered street address exists
  // for this property; guests get exact directions via the maps link once
  // booked).
  address: "Near Thika Road Mall (TRM), Nairobi, Kenya",
  // Client-facing "reach out to us" address — shown site-wide and used as
  // the default reply-to on automated emails. Deliberately NOT the admin
  // login email (pamhokhomes@gmail.com), which stays whatever the admin
  // signed in with regardless of this value.
  contactEmail: "hello@pamhokhomes.com",
  // Displayed site-wide (footer, contact page, verify/maintenance banners)
  // as the guest-facing phone number. Distinct from admin_users.whatsapp_phone
  // (set in Settings), which powers the "Contact Host" WhatsApp button
  // specifically — see getAdminContactPhone in @/lib/data.
  phone: "+254 704 393 189",
  // Lockup (icon + "Pamhok Homes" wordmark) — homepage header only.
  // Everywhere else uses logoIconUrl instead.
  logoLockupUrl:
    "https://ajxijucojqkxszfkepqr.supabase.co/storage/v1/object/public/site-images/branding/logo.jpeg",
  logoIconUrl:
    "https://ajxijucojqkxszfkepqr.supabase.co/storage/v1/object/public/site-images/branding/icon.png",
};

// Single source of truth for check-in/check-out times — reference these
// instead of hardcoding the time as a string wherever it's mentioned
// (terms, house rules, confirmation messages, etc).
export const CHECK_IN_TIME = "1:00 PM";
export const CHECK_OUT_TIME = "10:00 AM";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/about", label: "About" },
  { href: "/amenities", label: "Amenities" },
  { href: "/neighborhood", label: "Neighborhood" },
  { href: "/contact", label: "Contact" },
];

// The WhatsApp "Contact Host" number is set by the admin in Settings and
// stored on admin_users.whatsapp_phone (distinct from SITE.phone above) — no
// hardcoded site-wide WhatsApp number, so callers must fetch it (see
// getAdminContactPhone in @/lib/data) and treat null as "no WhatsApp button
// available yet."
export function whatsappLink(phone: string, message?: string) {
  const base = `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// Every route's <title> follows "<page> — SITE.name" (or just SITE.name for
// the homepage) — use this instead of hardcoding the business name in each
// page's metadata.
export function pageTitle(suffix?: string) {
  return suffix ? `${suffix} — ${SITE.name}` : SITE.name;
}
