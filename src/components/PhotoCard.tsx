import Image from "next/image";
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
      className={`photo-frame group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${className}`}
    >
      {url ? (
        <Image
          src={url}
          alt={label}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
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
