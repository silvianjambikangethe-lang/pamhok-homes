import { Eye, UsersThree } from "@phosphor-icons/react";
import RoomPhoto from "@/components/RoomPhoto";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Mirrors the public /rooms listing card exactly (see
// src/components/RoomsBrowser.tsx) so admins can see how in-progress edits
// will actually look to a guest, before saving.
export default function RoomCardPreview({
  name,
  description,
  pricePerNight,
  currency,
  maxGuests,
  bedConfig,
  photoUrl,
  photoLabel,
  seed,
}: {
  name: string;
  description: string;
  pricePerNight: number;
  currency: string;
  maxGuests: number;
  bedConfig: string;
  photoUrl: string | undefined;
  photoLabel: string;
  seed: string;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink/55">
        <Eye size={14} />
        How this looks to guests on /rooms
      </p>
      <div className="flex max-w-sm flex-col overflow-hidden rounded-2xl border border-taupe/20 bg-surface shadow-card">
        <RoomPhoto
          url={photoUrl}
          label={photoLabel || name}
          seed={seed}
          className="aspect-[4/3] w-full"
        />
        <div className="flex flex-1 flex-col p-6">
          <h2 className="font-serif text-h3 text-ink">{name || "Untitled room"}</h2>
          <p className="mt-2 line-clamp-2 text-body-sm text-ink/65">
            {description || "No description yet."}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-small text-ink/65">
            <UsersThree size={16} />
            Up to {maxGuests} guests · {bedConfig || "Bed configuration not set"}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-taupe/20 pt-4">
            <span className="font-serif text-price text-terracotta-600">
              {Number.isFinite(pricePerNight) ? formatCurrency(pricePerNight, currency) : "—"}
              <span className="text-small font-normal text-ink/65"> / night</span>
            </span>
            <span className="text-btn text-terracotta-600">View →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
