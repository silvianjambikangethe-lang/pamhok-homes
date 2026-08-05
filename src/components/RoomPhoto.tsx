import PlaceholderImage from "@/components/PlaceholderImage";

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
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={label} className={`object-cover ${className ?? ""}`} />;
  }
  return <PlaceholderImage label={label} seed={seed} className={className} />;
}
