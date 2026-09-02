import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import type {
  AboutContent,
  AmenityItem,
  AvailabilityRow,
  ContactContent,
  HomepageContent,
  NeighborhoodContent,
  Review,
  Room,
  SiteContent,
  SiteStatus,
  SocialLink,
  TermsContent,
} from "@/lib/supabase/types";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// Read-only anon client for public data (room listings, availability,
// reviews) fetched from Server Components. Not exported — callers use the
// helpers below, which fall back to sample data until Supabase is connected.
function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Sample rooms shown until the real Supabase project is connected and
// `supabase/schema.sql` has been run + seeded. Once NEXT_PUBLIC_SUPABASE_URL
// and NEXT_PUBLIC_SUPABASE_ANON_KEY are set, real `rooms` table rows take over.
const SAMPLE_ROOMS: Room[] = [
  {
    id: "sample-garden-room",
    name: "The Garden Room",
    slug: "garden-room",
    description:
      "A cozy double room with soft natural light and garden views — perfect for solo travelers or couples who want a quiet retreat close to everything Thika Road Mall has to offer.",
    price_per_night: 4500,
    currency: "KES",
    max_guests: 2,
    bed_config: "1 Queen bed",
    amenities: [
      "Free WiFi",
      "Free Parking",
      "Full Kitchen Access",
      "In-Room Safe",
      "Dry Cleaning",
    ],
    photo_labels: ["Garden Room bed", "Garden Room desk", "Ensuite bathroom"],
    photo_urls: [],
    door_code: null,
    wifi_password: null,
    wifi_network_name: null,
    display_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "sample-family-suite",
    name: "The Family Suite",
    slug: "family-suite",
    description:
      "Two connected bedrooms with a shared living area — spacious enough for families or small groups, without losing the warm, personal Pamhok touch.",
    price_per_night: 8500,
    currency: "KES",
    max_guests: 4,
    bed_config: "1 Queen bed + 2 Singles",
    amenities: [
      "Free WiFi",
      "Free Parking",
      "Full Kitchen Access",
      "In-Room Safe",
      "Dry Cleaning",
    ],
    photo_labels: ["Family Suite living area", "Family Suite bedroom", "Second bedroom"],
    photo_urls: [],
    door_code: null,
    wifi_password: null,
    wifi_network_name: null,
    display_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "sample-studio-loft",
    name: "The Studio Loft",
    slug: "studio-loft",
    description:
      "A bright, modern studio with its own kitchenette — ideal for remote workers or short business trips near TRM.",
    price_per_night: 5500,
    currency: "KES",
    max_guests: 2,
    bed_config: "1 Queen bed",
    amenities: [
      "Free WiFi",
      "Free Parking",
      "Full Kitchen Access",
      "In-Room Safe",
    ],
    photo_labels: ["Studio Loft interior", "Studio Loft workspace", "Kitchenette"],
    photo_urls: [],
    door_code: null,
    wifi_password: null,
    wifi_network_name: null,
    display_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export async function getRooms(): Promise<{ rooms: Room[]; isSample: boolean }> {
  if (!isSupabaseConfigured()) {
    return { rooms: SAMPLE_ROOMS, isSample: true };
  }

  const { data, error } = await publicClient()
    .from("rooms")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  // Sample data is a dev-convenience fallback for "not connected/reachable"
  // — NOT for "connected and genuinely has zero rooms right now." A live
  // site with no active rooms should show an empty state, never silently
  // resurrect fake listings.
  if (error) {
    return { rooms: SAMPLE_ROOMS, isSample: true };
  }

  return { rooms: data ?? [], isSample: false };
}

export async function getRoomBySlug(
  slug: string,
): Promise<{ room: Room | null; isSample: boolean }> {
  if (!isSupabaseConfigured()) {
    return {
      room: SAMPLE_ROOMS.find((r) => r.slug === slug) ?? null,
      isSample: true,
    };
  }

  const { data, error } = await publicClient()
    .from("rooms")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  // Same reasoning as getRooms(): only fall back to sample data on a real
  // connection error. A slug that's properly configured but genuinely not
  // found (e.g. an old link to a room that no longer exists) must return
  // null here so the caller's notFound() fires — not resurrect a fake
  // sample room that happens to share the same slug.
  if (error) {
    return {
      room: SAMPLE_ROOMS.find((r) => r.slug === slug) ?? null,
      isSample: true,
    };
  }

  return { room: data, isSample: false };
}

export async function getAvailability(roomId: string): Promise<AvailabilityRow[]> {
  if (!isSupabaseConfigured() || roomId.startsWith("sample-")) {
    return [];
  }

  const { data, error } = await publicClient()
    .from("availability_view")
    .select("*")
    .eq("room_id", roomId);

  if (error || !data) return [];
  return data;
}

// Same data as getAvailability(), but across every room at once — used by
// the /rooms listing page to filter the whole grid down to rooms with no
// conflicting booking for a guest-picked date range, without a round trip
// per room.
export async function getAllAvailability(): Promise<AvailabilityRow[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await publicClient().from("availability_view").select("*");

  if (error || !data) return [];
  return data;
}

const SAMPLE_REVIEWS: Review[] = [
  {
    id: "sample-1",
    booking_id: "sample",
    rating: 5,
    comment:
      "Felt like staying at a friend's place, not a hotel. Spotless and welcoming.",
    guest_display_name: "Amina W.",
    featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "sample-2",
    booking_id: "sample",
    rating: 5,
    comment:
      "Perfect base for a TRM trip — five minutes from everything, and the host was incredibly responsive.",
    guest_display_name: "David K.",
    featured: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "sample-3",
    booking_id: "sample",
    rating: 5,
    comment:
      "Loved the little touches. Fast WiFi, comfortable bed, and the neighborhood recommendations were spot on.",
    guest_display_name: "Grace N.",
    featured: true,
    created_at: new Date().toISOString(),
  },
];

export async function getReviews(): Promise<{ reviews: Review[]; isSample: boolean }> {
  if (!isSupabaseConfigured()) {
    return { reviews: SAMPLE_REVIEWS, isSample: true };
  }

  const { data, error } = await publicClient()
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data || data.length === 0) {
    return { reviews: SAMPLE_REVIEWS, isSample: true };
  }

  return { reviews: data, isSample: false };
}

// Homepage-facing subset: only reviews an admin has explicitly featured
// (see /admin/reviews), not just the most recent ones — a 1-star review
// submitted five minutes ago shouldn't outrank a 5-star one from last
// month just by being newer. Falls back to sample testimonials only when
// nothing has been featured yet, same "never blend real and fake" rule as
// getReviews() — once even one real review is featured, that's what shows,
// however few.
export async function getFeaturedReviews(): Promise<{ reviews: Review[]; isSample: boolean }> {
  if (!isSupabaseConfigured()) {
    return { reviews: SAMPLE_REVIEWS, isSample: true };
  }

  const { data, error } = await publicClient()
    .from("reviews")
    .select("*")
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error || !data || data.length === 0) {
    return { reviews: SAMPLE_REVIEWS, isSample: true };
  }

  return { reviews: data, isSample: false };
}

// Admin-editable public site copy — falls back to these defaults (the
// site's original hardcoded copy) if Supabase isn't configured or the row
// is missing, so a fresh/misconfigured project still renders real content.
const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  eyebrow: "Nairobi · Near Thika Road Mall",
  headline: "A home away from home, waiting for you",
  subtext:
    "Warm, welcoming rooms with a personal touch — steps from Thika Road Mall. Book directly with us, no middlemen, no surprises.",
  hero_image_url: null,
  living_room_image_url: null,
  bedroom_image_url: null,
  kitchen_image_url: null,
};

const DEFAULT_ABOUT_CONTENT: AboutContent = {
  body: "Pamhok Homes began as a single spare room offered to a friend passing through Nairobi. What started as a favor turned into something we couldn't stop doing — welcoming travelers, families, and remote workers into a space that actually feels lived-in and cared for.\n\nWe're not a hotel chain, and we don't want to be. Every room is personally prepared, every check-in is guided by a real person, and every guest gets our WhatsApp number, not a call center. Being just minutes from Thika Road Mall means you're close to everything, but coming home to Pamhok still feels quiet, warm, and yours.\n\nOur promise is simple: treat every stay the way we'd want a friend to be treated in our own home.",
  image_url: null,
  coffee_corner_image_url: null,
  reading_nook_image_url: null,
};

const DEFAULT_AMENITIES_CONTENT: AmenityItem[] = [
  {
    icon: "WifiHigh",
    title: "Free WiFi",
    description:
      "Fast, reliable internet throughout the property — ready for work calls or streaming.",
  },
  {
    icon: "Car",
    title: "Free Parking",
    description: "Secure on-site parking included with every stay, no extra fees.",
  },
  {
    icon: "ForkKnife",
    title: "Full Kitchen",
    description: "A well-equipped kitchen so you can cook your own meals whenever you like.",
  },
  {
    icon: "Lock",
    title: "In-Room Safe",
    description: "Keep your passport, cash, and valuables secure during your stay.",
  },
  {
    icon: "Broom",
    title: "Dry Cleaning",
    description: "On-request dry cleaning service, arranged through your host.",
  },
];

// Seeded from the Terms page's original hardcoded copy so converting it
// to admin-editable content doesn't lose or change any existing wording.
// The check-in/check-out times are written as plain text here (matching
// the site.ts CHECK_IN_TIME/CHECK_OUT_TIME constants at the time of this
// migration) rather than interpolated live — those constants aren't
// admin-editable anywhere else in the app either, so this doesn't
// introduce a new inconsistency; if they're ever changed in code, this
// section's wording would need a matching manual edit here too.
const DEFAULT_TERMS_CONTENT: TermsContent = {
  last_updated: "4 August 2026",
  sections: [
    {
      title: "1. Booking & Payment",
      body: "- All bookings are confirmed only once payment has been received in full through one of our accepted payment methods: M-Pesa or PayPal (which also accepts cards directly, no PayPal account required).\n- Prices are listed in Kenyan Shillings (KES); amounts shown in other currencies are approximate conversions for reference only.\n- A unique booking reference number is issued upon confirmation.",
    },
    {
      title: "2. Identity Verification",
      body: "- Guests are required to submit a valid government-issued ID for verification before receiving access details (door code, WiFi).\n- ID verification is processed automatically through a third-party verification service. In some cases, the host may manually review and approve a booking if automated verification is inconclusive.\n- Access to the property will not be granted until both payment and ID verification are complete.",
    },
    {
      title: "3. Check-In & Check-Out",
      body: "- Self check-in instructions, including the door code and WiFi password, are provided once verification is complete.\n- **Check-in time: 1:00 PM**\n- **Check-out time: 10:00 AM**\n- Check-out must be confirmed through the guest portal, including completion of the check-out checklist (lights off, room locked, keys in the keybox).\n- Late check-out may be requested as a stay extension, subject to availability and additional payment.",
    },
    {
      title: "4. Stay Extensions",
      body: "Guests may request to extend their stay through the guest portal, subject to availability. Extensions are confirmed only once additional payment is received.",
    },
    {
      title: "5. Additional Services",
      body: "Laundry pickup service may be requested through the guest portal during an active stay. Laundry is charged separately from your room rate and is priced per kilogram: items are weighed at pickup, and you will be shown the total price and asked to confirm before any payment is taken.",
    },
    {
      title: "6. Cancellations & Refunds",
      body: "- To cancel a booking, contact the host directly by phone — cancellations are not self-service through the site. This applies whether or not a refund applies, so the reservation can be removed from the calendar and the room freed up for other guests.\n- Cancellations made at least 48 hours before check-in are eligible for a full refund.\n- Cancellations made less than 48 hours before check-in are not eligible for a refund through the site. In this case, please contact the host directly by phone as soon as possible — refund or credit at the host's discretion may still be possible depending on the circumstances.\n- Refunds are processed manually by the host (M-Pesa, bank transfer, or through PayPal, depending on how you paid) after the cancellation is confirmed — they are not issued automatically by the site.",
    },
    {
      title: "7. House Rules",
      body: "- **Maximum occupancy: 2 people per booking.**\n- **No parties or events of any kind.**\n- **No pets allowed.**\n- **No smoking inside the property** — this includes, but is not limited to, tobacco and bangi (marijuana). Any smoking of any substance inside the property is strictly prohibited.\n- Guests found in violation of these house rules may have their booking cancelled without refund, at the host's discretion.",
    },
    {
      title: "8. Liability",
      body: "- Pamhok Homes is not liable for loss, theft, or damage to personal belongings during a guest's stay, except where caused by proven negligence on the part of the host.\n- Guests are responsible for any damage caused to the property during their stay beyond normal wear and tear.",
    },
    {
      title: "9. Changes to These Terms",
      body: "Pamhok Homes may update these Terms from time to time. Continued use of the site or a new booking after changes constitutes acceptance of the updated Terms.",
    },
  ],
};

const DEFAULT_CONTACT_CONTENT: ContactContent = {
  address_text: "Near Thika Road Mall (TRM), Nairobi, Kenya",
  address_note: "Exact address shared after booking confirmation",
  intro_line:
    "Questions about a stay, or need something during your trip? Reach us directly — a real person always answers.",
  maps_url: null,
  maps_lat: null,
  maps_lng: null,
};

// Starts empty rather than pre-seeded with placeholder recommendations —
// same reasoning as sample rooms: a host's actual neighborhood picks,
// added from /admin/content, not generic guesses baked into the code.
const DEFAULT_NEIGHBORHOOD_CONTENT: NeighborhoodContent = {
  food: [],
  recreation: [],
};

const DEFAULT_SITE_STATUS: SiteStatus = { is_open: true };

async function getSiteContentValue<T>(key: SiteContent["key"], fallback: T): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;

  const { data, error } = await publicClient()
    .from("site_content")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return fallback;
  return data.value as T;
}

export function getHomepageContent(): Promise<HomepageContent> {
  return getSiteContentValue("homepage", DEFAULT_HOMEPAGE_CONTENT);
}

export function getAboutContent(): Promise<AboutContent> {
  return getSiteContentValue("about", DEFAULT_ABOUT_CONTENT);
}

export function getAmenitiesContent(): Promise<AmenityItem[]> {
  return getSiteContentValue("amenities", DEFAULT_AMENITIES_CONTENT);
}

export function getContactContent(): Promise<ContactContent> {
  return getSiteContentValue("contact", DEFAULT_CONTACT_CONTENT);
}

export function getSiteStatus(): Promise<SiteStatus> {
  return getSiteContentValue("site_status", DEFAULT_SITE_STATUS);
}

export function getNeighborhoodContent(): Promise<NeighborhoodContent> {
  return getSiteContentValue("neighborhood", DEFAULT_NEIGHBORHOOD_CONTENT);
}

export function getTermsContent(): Promise<TermsContent> {
  return getSiteContentValue("terms", DEFAULT_TERMS_CONTENT);
}

// The public site's "Chat on WhatsApp" / "Contact Host" buttons link to
// whichever admin has a WhatsApp number saved (Settings → Change Phone
// Number). There's no public RLS policy on admin_users — it holds emails
// and auth-linked ids — so this reads via the service-role client rather
// than the anon publicClient(), same reasoning as the guest-portal-by-token
// lookups in @/lib/portal. Returns null (button simply doesn't render)
// until an admin sets a number.
export async function getAdminContactPhone(): Promise<string | null> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return null;

  const { data } = await createAdminSupabaseClient()
    .from("admin_users")
    .select("whatsapp_phone")
    .not("whatsapp_phone", "is", null)
    .limit(1)
    .maybeSingle();

  return data?.whatsapp_phone ?? null;
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await publicClient()
    .from("social_links")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error || !data) return [];
  return data;
}
