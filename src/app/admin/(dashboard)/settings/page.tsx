import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSiteStatus } from "@/lib/data";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import ChangePhoneForm from "@/components/admin/ChangePhoneForm";
import SiteStatusForm from "@/components/admin/SiteStatusForm";
import StaffCredentialsForm from "@/components/admin/StaffCredentialsForm";
import StaffMembersForm from "@/components/admin/StaffMembersForm";
import { pageTitle } from "@/lib/site";
import type { StaffMember } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: pageTitle("Settings"),
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();
  const siteStatus = await getSiteStatus();

  // staff_users has no admin-facing RLS policy at all (the host manages
  // it exclusively via the service-role client, see
  // /api/admin/staff-credentials) — so reading the current staff email
  // for this page also needs the service-role client, not the session
  // client used everywhere else on this page.
  const adminClient = createAdminSupabaseClient();
  const { data: staffUser } = await adminClient.from("staff_users").select("email").maybeSingle();

  const { data: staffMembersData } = await supabase
    .from("staff_members")
    .select("id, name, active, created_at")
    .order("name", { ascending: true });
  const staffMembers = (staffMembersData ?? []) as StaffMember[];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-h2 text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink/70">
        Update your login password or the WhatsApp number guests use to contact you directly.
      </p>

      <div className="mt-6 space-y-6">
        <SiteStatusForm initial={siteStatus} />
        <ChangePasswordForm />
        <ChangePhoneForm />
        {staffUser && <StaffCredentialsForm currentEmail={staffUser.email} />}
        <StaffMembersForm initial={staffMembers} />
      </div>
    </div>
  );
}
