export const SITE = {
  name: "Pamhok Homes",
  tagline: "A home away from home, near Thika Road Mall",
  city: "Nairobi, Kenya",
  contactEmail: "pamhokhomes@gmail.com",
  phone: "+254 704 393 189",
  // Lockup (icon + "Pamhok Homes" wordmark) — homepage header only, per
  // logo-placement-guide.md. Everywhere else uses logoIconUrl instead.
  logoLockupUrl:
    "https://ajxijucojqkxszfkepqr.supabase.co/storage/v1/object/public/site-images/branding/logo.jpeg",
  logoIconUrl:
    "https://ajxijucojqkxszfkepqr.supabase.co/storage/v1/object/public/site-images/branding/icon.png",
};

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/about", label: "About" },
  { href: "/amenities", label: "Amenities" },
  { href: "/neighborhood", label: "Neighborhood" },
  { href: "/contact", label: "Contact" },
];

// `phone` is the host's contact number, set by the admin in Settings and
// stored on admin_users.whatsapp_phone — no hardcoded site-wide number, so
// callers must fetch it (see getAdminContactPhone in @/lib/data) and treat
// null as "no WhatsApp button available yet."
export function whatsappLink(phone: string, message?: string) {
  const base = `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
