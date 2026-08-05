"use client";

import { useState } from "react";
import { CheckCircle, DoorOpen, WifiHigh } from "@phosphor-icons/react";
import RoomPhotoSlots from "@/components/admin/RoomPhotoSlots";

interface RoomSetting {
  id: string;
  name: string;
  description: string;
  price_per_night: number;
  currency: string;
  door_code: string | null;
  wifi_password: string | null;
  wifi_network_name: string | null;
  display_order: number;
  photo_urls: string[];
  photo_labels: string[];
}

function RoomRow({ room }: { room: RoomSetting }) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description);
  const [pricePerNight, setPricePerNight] = useState(String(room.price_per_night));
  const [displayOrder, setDisplayOrder] = useState(String(room.display_order));
  const [doorCode, setDoorCode] = useState(room.door_code ?? "");
  const [wifiNetworkName, setWifiNetworkName] = useState(room.wifi_network_name ?? "");
  const [wifiPassword, setWifiPassword] = useState(room.wifi_password ?? "");
  const [photoUrls, setPhotoUrls] = useState(room.photo_urls);
  const [photoLabels, setPhotoLabels] = useState(room.photo_labels);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function markDirty() {
    setSaved(false);
  }

  function setPhotoAt(index: number, url: string) {
    setPhotoUrls((prev) => {
      const next = [...prev];
      next[index] = url;
      return next;
    });
    markDirty();
  }

  function setPhotoLabelAt(index: number, label: string) {
    setPhotoLabels((prev) => {
      const next = [...prev];
      next[index] = label;
      return next;
    });
    markDirty();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(pricePerNight);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price per night.");
      return;
    }
    const order = Number(displayOrder);
    if (!Number.isFinite(order)) {
      setError("Enter a valid room order.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/admin/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        pricePerNight: price,
        displayOrder: order,
        doorCode,
        wifiNetworkName,
        wifiPassword,
        photoUrls,
        photoLabels,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not save changes.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSaved(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gold-500/20 bg-surface p-6 shadow-card"
    >
      <h3 className="font-serif text-lg font-semibold text-ink">{room.name}</h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-ink/80">Room name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              markDirty();
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">
            Price per night ({room.currency})
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={pricePerNight}
            onChange={(e) => {
              setPricePerNight(e.target.value);
              markDirty();
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">
            Room order
          </label>
          <input
            type="number"
            step="1"
            value={displayOrder}
            onChange={(e) => {
              setDisplayOrder(e.target.value);
              markDirty();
            }}
            placeholder="e.g. 1"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="text-sm font-medium text-ink/80">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              markDirty();
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
      </div>

      <div className="mt-5">
        <RoomPhotoSlots
          photoPathPrefix={`rooms/${room.id}`}
          photoUrls={photoUrls}
          photoLabels={photoLabels}
          onPhotoChange={setPhotoAt}
          onLabelChange={setPhotoLabelAt}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
            <DoorOpen size={16} /> Door code
          </label>
          <input
            type="text"
            value={doorCode}
            onChange={(e) => {
              setDoorCode(e.target.value);
              markDirty();
            }}
            placeholder="Not set"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
            <WifiHigh size={16} /> WiFi network name
          </label>
          <input
            type="text"
            value={wifiNetworkName}
            onChange={(e) => {
              setWifiNetworkName(e.target.value);
              markDirty();
            }}
            placeholder="Not set"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink/80">
            <WifiHigh size={16} /> WiFi password
          </label>
          <input
            type="text"
            value={wifiPassword}
            onChange={(e) => {
              setWifiPassword(e.target.value);
              markDirty();
            }}
            placeholder="Not set"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring rounded-full bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle size={16} weight="fill" /> Saved — applies to all future verified guests
          </span>
        )}
      </div>
    </form>
  );
}

export default function RoomSettingsForm({ rooms }: { rooms: RoomSetting[] }) {
  return (
    <div className="space-y-4">
      {rooms.map((room) => (
        <RoomRow key={room.id} room={room} />
      ))}
    </div>
  );
}
