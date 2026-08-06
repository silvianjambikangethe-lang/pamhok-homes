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

// The public site's "Chat on WhatsApp" / "Contact Host" buttons link to
// whichever admin has a WhatsApp number saved (Settings → Change Phone
// Number). There's no public RLS policy on admin_users — it holds emails
// and auth-linked ids — so this reads via the service-role client rather
// than the anon publicClient(), same reasoning as the guest-portal-by-token
// lookups in @/lib/portal. Returns null (button simply doesn't render)
// until an admin sets a number.
export async function getAdminContactPhone(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

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
