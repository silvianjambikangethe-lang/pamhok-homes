import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import RecoverSetPasswordForm from "@/components/admin/RecoverSetPasswordForm";
import { pageTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: pageTitle("Set New Password"),
  robots: { index: false, follow: false },
};

// Reached only via the emailed reset link's callback, which exchanges the
// one-time code for a real session — requireAdmin() below is the same
// admin_users-membership check every other dashboard page uses, so this
// page can't be reached without a valid session either way.
export default async function AdminRecoverSetPasswordPage() {
  await requireAdmin();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <RecoverSetPasswordForm />
      </div>
    </div>
  );
}
