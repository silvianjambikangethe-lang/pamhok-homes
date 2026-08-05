import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";
import ChangePhoneForm from "@/components/admin/ChangePhoneForm";

export const metadata: Metadata = {
  title: "Settings — Pamhok Homes",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-h2 text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink/70">
        Update your login password or the WhatsApp number guests use to contact you directly.
      </p>

      <div className="mt-6 space-y-6">
        <ChangePasswordForm />
        <ChangePhoneForm />
      </div>
    </div>
  );
}
