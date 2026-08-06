import { createServerSupabaseClient } from "@/lib/supabase/server";
import RoomSettingsForm from "@/components/admin/RoomSettingsForm";
import AddRoomForm from "@/components/admin/AddRoomForm";

export default async function AdminRoomsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select(
      "id, slug, name, description, price_per_night, currency, max_guests, bed_config, door_code, wifi_password, wifi_network_name, display_order, photo_urls, photo_labels",
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-h2 text-ink">Room Settings</h1>
        <p className="mt-1 text-sm text-ink/80">
          Edit each room&apos;s public details and photos, plus its door
          code, WiFi network name, and WiFi password — property details, not
          tied to any one booking, so a change here applies to every future
          verified guest immediately. Room order controls where each room
          appears on the site and in this list.
        </p>
      </div>

      <AddRoomForm />

      <RoomSettingsForm rooms={rooms ?? []} />
    </div>
  );
}
