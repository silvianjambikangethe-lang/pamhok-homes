import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteStatus } from "@/lib/data";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import ChangePhoneForm from "@/components/admin/ChangePhoneForm";
import SiteStatusForm from "@/components/admin/SiteStatusForm";
import StaffCredentialsForm from "@/components/admin/StaffCredentialsForm";
import StaffMembersForm from "@/components/admin/StaffMembersForm";
import PasskeysForm from "@/components/admin/PasskeysForm";
import BlockedGuestNamesForm from "@/components/admin/BlockedGuestNamesForm";
import { pageTitle } from "@/lib/site";
import type { StaffMember, BlockedGuestName } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: pageTitle("Settings"),
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const { supabase, admin } = await requireAdmin();
  const siteStatus = await getSiteStatus();

  // staff_users has no admin-facing RLS policy at all (the host manages
  // it exclusively via the service-role client, see
  // /api/admin/staff-credentials) — so reading the current staff email
  // for this page also needs the service-role client, not the session
  // client used everywhere else on this page.
  const adminClient = createAdminSupabaseClient();
  const { data: staffUser } = await adminClient.from("staff_users").select("email").maybeSingle();

  // Same reasoning as staff_users above — passkey_credentials has no
  // RLS policies at all (service-role-only, see the migration).
  const { data: passkeysData } = await adminClient
    .from("passkey_credentials")
    .select("id, device_name, created_at, last_used_at")
    .eq("admin_user_id", admin.id)
    .order("created_at", { ascending: false });

  const { data: staffMembersData } = await supabase
    .from("staff_members")
    .select("id, name, active, created_at")
    .order("name", { ascending: true });
  const staffMembers = (staffMembersData ?? []) as StaffMember[];

  const { data: blockedNamesData } = await supabase
    .from("blocked_guest_names")
    .select("id, full_name, full_name_normalized, reason, created_at")
    .order("created_at", { ascending: false });
  const blockedNames = (blockedNamesData ?? []) as BlockedGuestName[];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-h2 text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink/70">
        Update your login password or the WhatsApp number guests use to contact you directly.
      </p>

      <div className="mt-6 space-y-6">
        <SiteStatusForm initial={siteStatus} />
        <ChangePasswordForm />
        <PasskeysForm initial={passkeysData ?? []} />
        <ChangePhoneForm />
        {staffUser && <StaffCredentialsForm currentEmail={staffUser.email} />}
        <StaffMembersForm initial={staffMembers} />
        <BlockedGuestNamesForm initial={blockedNames} />
      </div>
    </div>
  );
}
