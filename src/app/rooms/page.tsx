import type { Metadata } from "next";
import { Info } from "@phosphor-icons/react/dist/ssr";
import { getAllAvailability, getRooms } from "@/lib/data";
import PageBanner from "@/components/PageBanner";
import RoomsBrowser from "@/components/RoomsBrowser";

export const metadata: Metadata = {
  title: "Rooms & Availability — Pamhok Homes",
  description:
    "Browse our rooms and check live availability at Pamhok Homes, Nairobi.",
};

export default async function RoomsPage() {
  const { rooms, isSample } = await getRooms();
  const availability = await getAllAvailability();

  return (
    <div>
      <PageBanner color="forest" eyebrow="Rooms" title="Find your room" />

      <div className="container-page py-16 sm:py-20">
      <div className="text-center">
        <p className="mx-auto max-w-xl text-body text-ink/80">
          Every room comes with free WiFi, free parking, and full kitchen
          access. Pick your dates below to see which rooms are open.
        </p>
      </div>

      {isSample && (
        <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-gold-500/30 bg-gold-50 p-4 text-sm text-ink/80 dark:bg-gold-700/15">
          <Info size={20} className="mt-0.5 shrink-0 text-gold-700 dark:text-gold-300" />
          <p>
            Showing sample rooms — connect your Supabase project and run{" "}
            <code className="rounded bg-page px-1 py-0.5 text-xs">
              supabase/schema.sql
            </code>{" "}
            to manage real rooms from the admin dashboard.
          </p>
        </div>
      )}

      {!isSample && rooms.length === 0 && (
        <p className="mx-auto mt-12 max-w-xl text-center text-body-sm text-ink/65">
          No rooms are available to book right now — please check back soon.
        </p>
      )}

      {rooms.length > 0 && (
        <div className="mt-12">
          <RoomsBrowser rooms={rooms} availability={availability} />
        </div>
      )}
      </div>
    </div>
  );
}
