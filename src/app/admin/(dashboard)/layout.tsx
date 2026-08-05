import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import AdminNav from "@/components/admin/AdminNav";
import { AdminTextSizeProvider } from "@/components/admin/AdminTextSizeContext";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { admin } = await requireAdmin();

  // One-time required setup, asked once — powers the guest-facing "Contact
  // Host" WhatsApp button (Footer, Contact page, guest portal), not any
  // automated alerting. Lives outside this layout group so it isn't itself
  // caught by this gate — see /admin/whatsapp-setup.
  if (!admin.whatsapp_phone) {
    redirect("/admin/whatsapp-setup");
  }

  return (
    <AdminTextSizeProvider>
      <div className="flex min-h-[calc(100vh-5rem)] flex-col lg:flex-row">
        <aside className="w-full bg-forest-700 dark:bg-[#191410] lg:w-64 lg:shrink-0">
          <AdminNav email={admin.email} />
        </aside>
        <div className="flex-1 bg-page p-6 sm:p-10">{children}</div>
      </div>
    </AdminTextSizeProvider>
  );
}
