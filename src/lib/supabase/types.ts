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
// Summary of an automated ID verification job (Dojah document analysis —
// see src/lib/dojah.ts), stored for the admin's manual-override decision
// when the auto-check doesn't pass. resultCode is "provider_error" (rather
// than a real Dojah verdict) when Dojah itself was unreachable/misconfigured
// — that outcome doesn't count against the guest's attempts.
export type IdVerificationResult = {
  success: boolean;
  resultCode: string | null;
  resultText: string | null;
  actions: Record<string, string> | null;
  checkedAt: string;
  // Name OCR-extracted from the ID by Dojah, and whether it was compared
  // against the booking name — both null for verifications run before
  // this field existed, or when the document type had no readable name
  // field at all (in which case nameMatch is null, not false: there was
  // nothing to compare, not a failed comparison).
  extractedName?: string | null;
  nameMatch?: boolean | null;
};
export type GuestRequestType = "cleaning" | "assistance" | "other" | "laundry" | "extension";
// 'cleaning' uses Open|In Progress|Resolved; 'assistance'/'other'/
// 'extension' use Open|Resolved; 'laundry' cycles through its own richer
// stage list — the column itself is unconstrained text in the DB, so all
// three sets of values are valid here. The staff dashboard displays
// "Open"/"Resolved" as "Pending"/"Done" — the DB keeps one canonical
// status space shared by both dashboards, no separate vocabulary to sync.
export type GuestRequestStatus =
  | "Open"
  | "In Progress"
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

// The one shared maintenance-staff login — a single row, not one per
// worker. Deliberately separate from admin_users so staff never inherit
// any of the "admins manage X" RLS policies — see supabase/schema.sql's
// "Maintenance staff" section.
export type StaffUser = {
  id: string;
  email: string;
  created_at: string;
};

// The "tap your name" roster, managed by the host from /admin/settings.
export type StaffMember = {
  id: string;
  name: string;
  active: boolean;
  // Checked at tap-in (src/lib/staff-pin.ts) — a hash, not a secret in
  // the sensitive-plaintext sense, but still deliberately left out of
  // the settings-page listing query; only routes that actually need it
  // select it explicitly.
  pin_hash: string | null;
  created_at: string;
};

export type ShiftLog = {
  id: string;
  staff_member_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
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
  id_document_back_path: string | null;
  id_document_path_2: string | null;
  id_document_back_path_2: string | null;
  id_verification_status: IdVerificationStatus;
  id_verification_method: IdVerificationMethod | null;
  id_verification_attempts: number;
  id_verification_result: IdVerificationResult | null;
  id_verification_result_2: IdVerificationResult | null;
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
  // Which staff_members row advanced/completed this — null until a
  // staff member (or an admin, who never sets this) touches it.
  completed_by: string | null;
  // true only for an auto-generated checkout/turnover cleaning row —
  // see staff_checkout_schedule in supabase/schema.sql.
  is_turnover: boolean;
  created_at: string;
};

// Row shapes for the staff-facing views (supabase/schema.sql's
// "Maintenance staff task views" section) — guest-free by construction,
// each field here is exactly what the underlying view selects.
export type StaffCleaningLaundryFeedRow = {
  id: string;
  request_type: GuestRequestType;
  status: GuestRequestStatus;
  message: string | null;
  created_at: string;
  completed_by: string | null;
  room_id: string;
  room_name: string;
};

export type StaffCheckoutScheduleRow = {
  booking_id: string;
  room_id: string;
  room_name: string;
  check_out: string;
  cleaning_request_id: string | null;
  cleaning_status: GuestRequestStatus | null;
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
  tour_videos: string[];
};

export type AboutContent = {
  body: string;
  image_url: string | null;
  coffee_corner_image_url: string | null;
  reading_nook_image_url: string | null;
  videos: string[];
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
  directions_video_url: string | null;
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

export type PasskeyCredential = {
  id: string;
  admin_user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name: string | null;
  transports: string[] | null;
  created_at: string;
  last_used_at: string | null;
};

export type PasskeyChallenge = {
  id: string;
  admin_user_id: string;
  type: "registration" | "authentication";
  challenge: string;
  created_at: string;
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

// Admin-maintained "do not book" list, checked against the booking name at
// booking time (src/app/api/bookings/route.ts). full_name_normalized is a
// lowercased, whitespace-collapsed copy of full_name computed at write
// time — booking-time lookups compare against this column instead of
// normalizing every row on every check.
export type BlockedGuestName = {
  id: string;
  full_name: string;
  full_name_normalized: string;
  reason: string | null;
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
      blocked_guest_names: {
        Row: BlockedGuestName;
        Insert: Partial<BlockedGuestName>;
        Update: Partial<BlockedGuestName>;
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
      passkey_credentials: {
        Row: PasskeyCredential;
        Insert: Partial<PasskeyCredential>;
        Update: Partial<PasskeyCredential>;
        Relationships: [];
      };
      passkey_challenges: {
        Row: PasskeyChallenge;
        Insert: Partial<PasskeyChallenge>;
        Update: Partial<PasskeyChallenge>;
        Relationships: [];
      };
      staff_users: {
        Row: StaffUser;
        Insert: Partial<StaffUser>;
        Update: Partial<StaffUser>;
        Relationships: [];
      };
      staff_members: {
        Row: StaffMember;
        Insert: Partial<StaffMember>;
        Update: Partial<StaffMember>;
        Relationships: [];
      };
      shift_logs: {
        Row: ShiftLog;
        Insert: Partial<ShiftLog>;
        Update: Partial<ShiftLog>;
        Relationships: [
          {
            foreignKeyName: "shift_logs_staff_member_id_fkey";
            columns: ["staff_member_id"];
            isOneToOne: false;
            referencedRelation: "staff_members";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      availability_view: {
        Row: AvailabilityRow;
        Relationships: [];
      };
      staff_cleaning_laundry_feed: {
        Row: StaffCleaningLaundryFeedRow;
        Relationships: [];
      };
      staff_checkout_schedule: {
        Row: StaffCheckoutScheduleRow;
        Relationships: [];
      };
      staff_task_updates: {
        Row: Pick<GuestRequest, "id" | "request_type" | "status" | "completed_by">;
        Update: Partial<Pick<GuestRequest, "status" | "completed_by">>;
        Relationships: [];
      };
      staff_clock_updates: {
        Row: Pick<ShiftLog, "id" | "staff_member_id" | "clock_in_at" | "clock_out_at">;
        Update: Partial<Pick<ShiftLog, "clock_out_at">>;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}
