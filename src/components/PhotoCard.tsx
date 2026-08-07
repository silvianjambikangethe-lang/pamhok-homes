import PlaceholderImage from "@/components/PlaceholderImage";

// Shared hover treatment for photo-grid slots on Home/About: the card
// lifts slightly and its image zooms in a touch, clipped by the card's
// own rounded corners (overflow-hidden on the outer element).
export default function PhotoCard({
  url,
  label,
  seed,
  className = "",
}: {
  url?: string | null;
  label: string;
  seed: string;
  className?: string;
}) {
  return (
    <div
      className={`photo-frame group overflow-hidden transition-all duration-300 hover:-translate-y-1 ${className}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <PlaceholderImage
          label={label}
          seed={seed}
          className="h-full w-full transition-transform duration-300 group-hover:scale-105"
        />
      )}
    </div>
  );
}
