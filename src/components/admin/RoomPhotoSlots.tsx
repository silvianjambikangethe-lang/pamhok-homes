"use client";

import ImageUploadField from "@/components/admin/ImageUploadField";

// Shared by both "Add a New Room" and each existing room's edit box, so
// the two experiences stay in the same format — 3 photo slots, each with
// upload/replace/remove and an editable name tag (stored as photo_labels,
// shown as the placeholder caption and as alt text on the real photo).
export default function RoomPhotoSlots({
  photoPathPrefix,
  photoUrls,
  photoLabels,
  onPhotoChange,
  onLabelChange,
}: {
  photoPathPrefix: string;
  photoUrls: string[];
  photoLabels: string[];
  onPhotoChange: (index: number, url: string) => void;
  onLabelChange: (index: number, label: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <ImageUploadField
            label={`Photo ${i + 1}`}
            currentUrl={photoUrls[i] || null}
            path={`${photoPathPrefix}/photo-${i}`}
            onUploaded={(url) => onPhotoChange(i, url)}
            onRemove={() => onPhotoChange(i, "")}
          />
          <input
            type="text"
            value={photoLabels[i] ?? ""}
            onChange={(e) => onLabelChange(i, e.target.value)}
            placeholder="Name tag (e.g. Bedroom)"
            className="focus-ring w-full rounded-lg border border-gold-500/25 bg-page px-3 py-2 text-xs text-ink"
          />
        </div>
      ))}
    </div>
  );
}
