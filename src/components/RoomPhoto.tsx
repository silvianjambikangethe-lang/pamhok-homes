import Image from "next/image";
import PlaceholderImage from "@/components/PlaceholderImage";

// Wraps in its own positioned div rather than requiring callers to
// provide one - `className` (aspect ratio, width, rounding, etc.) still
// works exactly as before, just applied to the wrapper instead of the
// image itself, since next/image's `fill` mode needs a positioned
// parent to size against.
export default function RoomPhoto({
  url,
  label,
  seed,
  className,
}: {
  url: string | undefined;
  label: string;
  seed: string;
  className?: string;
}) {
  if (url) {
    return (
      <div className={`relative overflow-hidden ${className ?? ""}`}>
        <Image src={url} alt={label} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
      </div>
    );
  }
  return <PlaceholderImage label={label} seed={seed} className={className} />;
}
