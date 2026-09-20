import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/portal";
import { getExchangeRates } from "@/lib/currency";
import { generateQrDataUrl } from "@/lib/qrcode";
import { makeVerifyToken } from "@/lib/verify-token";
import { getAdminContactPhone, getContactContent } from "@/lib/data";
import PortalClient from "@/components/portal/PortalClient";
import { SITE, pageTitle } from "@/lib/site";
import { buildDirectionsFromCurrentLocationUrl } from "@/lib/maps";

export const metadata: Metadata = {
  title: pageTitle("Your Stay"),
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

  const [rates, qrDataUrl, adminPhone, contactContent] = await Promise.all([
    getExchangeRates(),
    isPassReady
      ? generateQrDataUrl(
          // A signed code that identifies the pass, never the private portal
          // link: the QR is shown to other people.
          `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/verify/${makeVerifyToken(booking.id)}`,
        )
      : Promise.resolve(null),
    getAdminContactPhone(),
    getContactContent(),
  ]);

  // A plain place-share link only centers the map on the pin when
  // opened — it doesn't start a route. A destination-only directions
  // link does, using the guest's current location as the origin
  // automatically (see buildDirectionsFromCurrentLocationUrl).
  const directionsUrl =
    contactContent.maps_lat != null && contactContent.maps_lng != null
      ? buildDirectionsFromCurrentLocationUrl(`${SITE.name}, ${SITE.city}`)
      : contactContent.maps_url;

  return (
    <PortalClient
      booking={booking}
      token={token}
      rates={rates}
      qrDataUrl={qrDataUrl}
      adminPhone={adminPhone}
      mapsUrl={directionsUrl}
      directionsVideoUrl={contactContent.directions_video_url}
    />
  );
}
