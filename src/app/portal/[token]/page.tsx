import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/portal";
import { getExchangeRates } from "@/lib/currency";
import { generateQrDataUrl } from "@/lib/qrcode";
import { getAdminContactPhone } from "@/lib/data";
import PortalClient from "@/components/portal/PortalClient";

export const metadata: Metadata = {
  title: "Your Stay — Pamhok Homes",
  robots: { index: false, follow: false },
};

export default async function GuestPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const booking = await getBookingByToken(token);

  if (!booking) notFound();

  const isPassReady =
    booking.payment_status === "Paid" && booking.id_verification_status === "Verified";

  const [rates, qrDataUrl, adminPhone] = await Promise.all([
    getExchangeRates(),
    isPassReady
      ? generateQrDataUrl(
          `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/verify/${token}`,
        )
      : Promise.resolve(null),
    getAdminContactPhone(),
  ]);

  return (
    <PortalClient
      booking={booking}
      token={token}
      rates={rates}
      qrDataUrl={qrDataUrl}
      adminPhone={adminPhone}
    />
  );
}
