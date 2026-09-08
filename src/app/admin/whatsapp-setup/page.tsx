import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import WhatsappSetupForm from "@/components/admin/WhatsappSetupForm";
import { pageTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: pageTitle("WhatsApp Contact"),
  robots: { index: false, follow: false },
};

export default async function WhatsappSetupPage() {
  const { admin } = await requireAdmin();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <WhatsappSetupForm
        initialPhone={admin.whatsapp_phone}
        required={!admin.whatsapp_phone}
      />
    </div>
  );
}
