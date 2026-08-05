"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import RoomPhotoSlots from "@/components/admin/RoomPhotoSlots";

// Photos need somewhere to upload to before the room itself exists (its
// real id isn't known until the create call succeeds) — a random
// client-side id gives the upload path a home; the resulting URLs get
// submitted alongside the rest of the room on create, same as any other
// field. Regenerated after each successful create so the next new room
// gets its own fresh upload folder.
function newDraftId() {
  return crypto.randomUUID();
}

export default function AddRoomForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerNight, setPricePerNight] = useState("");
  const [maxGuests, setMaxGuests] = useState("2");
  const [bedConfig, setBedConfig] = useState("");
  const [amenities, setAmenities] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [doorCode, setDoorCode] = useState("");
  const [wifiNetworkName, setWifiNetworkName] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [draftId, setDraftId] = useState(newDraftId);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoLabels, setPhotoLabels] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setPhotoAt(index: number, url: string) {
    setPhotoUrls((prev) => {
      const next = [...prev];
      next[index] = url;
      return next;
    });
  }

  function setPhotoLabelAt(index: number, label: string) {
    setPhotoLabels((prev) => {
      const next = [...prev];
      next[index] = label;
      return next;
    });
  }

  function reset() {
    setName("");
    setDescription("");
    setPricePerNight("");
    setMaxGuests("2");
    setBedConfig("");
    setAmenities("");
    setDisplayOrder("");
    setDoorCode("");
    setWifiNetworkName("");
    setWifiPassword("");
    setDraftId(newDraftId());
    setPhotoUrls([]);
    setPhotoLabels([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(pricePerNight);
    if (!name.trim() || !Number.isFinite(price) || price <= 0) {
      setError("Room name and a valid price per night are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        pricePerNight: price,
        maxGuests: Number(maxGuests) || 2,
        bedConfig,
        amenities: amenities
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        displayOrder: displayOrder.trim() ? Number(displayOrder) : undefined,
        doorCode,
        wifiNetworkName,
        wifiPassword,
        photoUrls,
        photoLabels,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not create room.");
      setSubmitting(false);
      return;
    }

    reset();
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-dashed border-gold-500/40 bg-surface p-6 shadow-card"
    >
      <h2 className="font-serif text-lg font-semibold text-ink">Add a New Room</h2>
      <p className="mt-1 text-xs text-ink/65">
        It&apos;ll appear below once created — photos can be added now or later.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-ink/80">Room name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Loft Suite"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Price per night (KES)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={pricePerNight}
            onChange={(e) => setPricePerNight(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Max guests</label>
          <input
            type="number"
            min="1"
            step="1"
            value={maxGuests}
            onChange={(e) => setMaxGuests(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Bed configuration</label>
          <input
            type="text"
            value={bedConfig}
            onChange={(e) => setBedConfig(e.target.value)}
            placeholder="e.g. 1 Queen bed"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-ink/80">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-ink/80">
            Amenities (comma-separated)
          </label>
          <input
            type="text"
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="Free WiFi, Free Parking, Full Kitchen Access"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Room order (optional)</label>
          <input
            type="number"
            step="1"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            placeholder="e.g. 11"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Door code (optional)</label>
          <input
            type="text"
            value={doorCode}
            onChange={(e) => setDoorCode(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">WiFi network name (optional)</label>
          <input
            type="text"
            value={wifiNetworkName}
            onChange={(e) => setWifiNetworkName(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">WiFi password (optional)</label>
          <input
            type="text"
            value={wifiPassword}
            onChange={(e) => setWifiPassword(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-ink/80">Photos (optional)</p>
        <RoomPhotoSlots
          photoPathPrefix={`rooms/${draftId}`}
          photoUrls={photoUrls}
          photoLabels={photoLabels}
          onPhotoChange={setPhotoAt}
          onLabelChange={setPhotoLabelAt}
        />
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="focus-ring mt-4 flex items-center gap-1.5 rounded-full bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 disabled:opacity-60"
      >
        <Plus size={16} /> {submitting ? "Creating…" : "Add Room"}
      </button>
    </form>
  );
}
