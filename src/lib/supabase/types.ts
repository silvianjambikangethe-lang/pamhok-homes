export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";
export type PaymentMethod = "mpesa" | "paypal" | "manual";
export type BookingStatus = "Confirmed" | "Cancelled" | "Blocked" | "Pending Verification";
export type IdVerificationStatus =
  | "Not Submitted"
  | "Pending"
  | "Verified"
  | "Rejected";
export type IdVerificationMethod = "automatic" | "manual_override";
// Only set while a refund needs attention — cleared once resolved.
export type RefundStatus = "Needs Manual Refund";
// Summary of an automated ID verification job, stored for the admin's
// manual-override decision when the auto-check doesn't pass. Provider-
// agnostic shape — unused until an automated verification provider is
// configured; every upload currently goes straight to manual review.
export type IdVerificationResult = {
  success: boolean;
  resultCode: string | null;
  resultText: string | null;
  actions: Record<string, string> | null;
  checkedAt: string;
};
export type GuestRequestType = "cleaning" | "assistance" | "other" | "laundry" | "extension";
// 'cleaning'/'assistance'/'other' use Open|Resolved; 'laundry' cycles
// through its own richer stage list — the column itself is unconstrained
// text in the DB, so both sets of values are valid here.
export type GuestRequestStatus =
  | "Open"
  | "Resolved"
  | "Picked Up"
  | "Cleaning"
  | "Ready"
  | "Returned"
  | "Closed";

// These are `type` object literals, not `interface` declarations, on
// purpose: @supabase/supabase-js requires each table's Row to satisfy
// `Record<string, unknown>`, and TypeScript interfaces — being "open" to
// declaration merging — never structurally satisfy an index-signature
// type like Record, even with identical members. Using `interface` here
// silently collapses every `.from(table)` query's inferred type to
// `never` with no error at the call site.
export type Room = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_per_night: number;
  currency: string;
  max_guests: number;
  bed_config: string;
  amenities: string[];
  photo_labels: string[];
  photo_urls: string[];
  door_code: string | null;
  wifi_password: string | null;
  wifi_network_name: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type Guest = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type AdminUser = {
  id: string;
  email: string;
  whatsapp_phone: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  room_id: string | null;
  guest_id: string | null;
  access_token: string;
  booking_reference: string | null;
  pass_reference: string | null;
  check_in: string;
  check_out: string;
  total_amount: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  paid_at: string | null;
  booking_status: BookingStatus;
  block_note: string | null;
  id_document_path: string | null;
  id_selfie_path: string | null;
  id_verification_status: IdVerificationStatus;
  id_verification_method: IdVerificationMethod | null;
  id_verification_attempts: number;
  id_verification_result: IdVerificationResult | null;
  refund_status: RefundStatus | null;
  refund_amount: number | null;
  refund_reference: string | null;
  refunded_at: string | null;
  checked_out_at: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  pending_extension_check_out: string | null;
  pending_extension_nights: number | null;
  pending_extension_amount: number | null;
  pending_extension_requested_at: string | null;
};

export type GuestRequest = {
  id: string;
  booking_id: string;
  request_type: GuestRequestType;
  message: string | null;
  status: GuestRequestStatus;
  created_at: string;
};

export type Review = {
  id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  guest_display_name: string | null;
  featured: boolean;
  created_at: string;
};

export type AvailabilityRow = {
  room_id: string;
  check_in: string;
  check_out: string;
  booking_status: BookingStatus;
};

export type HomepageContent = {
  eyebrow: string;
  headline: string;
  subtext: string;
  hero_image_url: string | null;
  living_room_image_url: string | null;
  bedroom_image_url: string | null;
  kitchen_image_url: string | null;
};

export type AboutContent = {
  body: string;
  image_url: string | null;
  coffee_corner_image_url: string | null;
  reading_nook_image_url: string | null;
};

export type AmenityItem = {
  title: string;
  description: string;
  icon: string;
};

export type ContactContent = {
  address_text: string;
  address_note: string;
  intro_line: string;
  maps_url: string | null;
  maps_lat: number | null;
  maps_lng: number | null;
};

export type NeighborhoodItem = {
  name: string;
  detail: string;
  photo_url: string | null;
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
};

export type NeighborhoodContent = {
  food: NeighborhoodItem[];
  recreation: NeighborhoodItem[];
};

export type SiteStatus = {
  is_open: boolean;
};

// Each section's body is lightweight plain-text markup, not full markdown:
// lines starting with "- " render as a bullet list, blank lines separate
// paragraphs, and `**text**` renders bold — enough to reproduce the
// original hardcoded Terms page's formatting (bullet lists, bold house
// rules) from a plain textarea, without a rich-text editor.
export type TermsSection = {
  title: string;
  body: string;
};

export type TermsContent = {
  last_updated: string;
  sections: TermsSection[];
};

export type SiteContent = {
  key: "homepage" | "about" | "amenities" | "contact" | "neighborhood" | "site_status" | "terms";
  value:
    | HomepageContent
    | AboutContent
    | AmenityItem[]
    | ContactContent
    | NeighborhoodContent
    | SiteStatus
    | TermsContent;
  updated_at: string;
};

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "whatsapp"
  | "twitter"
  | "youtube";

export type SocialLink = {
  id: string;
  platform: SocialPlatform;
  url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type LoginAttempt = {
  email: string;
  attempt_count: number;
  locked_until: string | null;
  last_attempt_at: string;
};

export type RateLimit = {
  key: string;
  attempt_count: number;
  window_started_at: string;
};

export type BillingCycle = "monthly" | "annual" | "one-time";

export type BusinessExpense = {
  id: string;
  name: string;
  amount: number | null;
  currency: string;
  billing_cycle: BillingCycle;
  next_due_date: string;
  notes: string | null;
  created_at: string;
};

// @supabase/supabase-js resolves its Database generic structurally: every
// table needs a `Relationships` array and the schema needs a `Functions`
// key, or the whole schema silently collapses to `never` (every .from()
// call then types as `never` with no error at the call site — only at
// each downstream property access). This hand-written type isn't a
// `supabase gen types` output, so those fields are filled in by hand.
export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: Room;
        Insert: Partial<Room>;
        Update: Partial<Room>;
        Relationships: [];
      };
      guests: {
        Row: Guest;
        Insert: Partial<Guest>;
        Update: Partial<Guest>;
        Relationships: [];
      };
      admin_users: {
        Row: AdminUser;
        Insert: Partial<AdminUser>;
        Update: Partial<AdminUser>;
        Relationships: [];
      };
      bookings: {
        Row: Booking;
        Insert: Partial<Booking>;
        Update: Partial<Booking>;
        Relationships: [
          {
            foreignKeyName: "bookings_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["id"];
          },
        ];
      };
      guest_requests: {
        Row: GuestRequest;
        Insert: Partial<GuestRequest>;
        Update: Partial<GuestRequest>;
        Relationships: [
          {
            foreignKeyName: "guest_requests_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: Review;
        Insert: Partial<Review>;
        Update: Partial<Review>;
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      site_content: {
        Row: SiteContent;
        Insert: Partial<SiteContent>;
        Update: Partial<SiteContent>;
        Relationships: [];
      };
      social_links: {
        Row: SocialLink;
        Insert: Partial<SocialLink>;
        Update: Partial<SocialLink>;
        Relationships: [];
      };
      business_expenses: {
        Row: BusinessExpense;
        Insert: Partial<BusinessExpense>;
        Update: Partial<BusinessExpense>;
        Relationships: [];
      };
      login_attempts: {
        Row: LoginAttempt;
        Insert: Partial<LoginAttempt>;
        Update: Partial<LoginAttempt>;
        Relationships: [];
      };
      rate_limits: {
        Row: RateLimit;
        Insert: Partial<RateLimit>;
        Update: Partial<RateLimit>;
        Relationships: [];
      };
    };
    Views: {
      availability_view: {
        Row: AvailabilityRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
