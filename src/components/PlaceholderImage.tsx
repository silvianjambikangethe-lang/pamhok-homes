import { HouseLine } from "@phosphor-icons/react/dist/ssr";

const GRADIENTS = [
  "from-clay-300 via-clay-500 to-clay-700",
  "from-forest-300 via-forest-500 to-forest-700",
  "from-gold-300 via-gold-500 to-gold-700",
  "from-sand-200 via-clay-300 to-forest-500",
];

function hashToIndex(seed: string, length: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % length;
}

export default function PlaceholderImage({
  label,
  seed,
  className = "",
  showLabel = true,
}: {
  label: string;
  seed?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const gradient = GRADIENTS[hashToIndex(seed ?? label, GRADIENTS.length)];

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
      <HouseLine
        size={32}
        weight="light"
        className="text-cream-50 opacity-40"
      />
      {showLabel && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-charcoal/25 px-3 py-1.5 backdrop-blur-sm">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-cream-50/90">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
