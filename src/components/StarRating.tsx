import { Star } from "@phosphor-icons/react/dist/ssr";

// Stars for a rating from 1.0 to 5.0 in tenths: 4.3 shows four full stars and
// a fifth that is filled 30% of the way across. Used by the review form, the
// homepage reviews and the admin review list so they all read the same.
export default function StarRating({
  rating,
  size = 16,
  showEmpty = true,
  className = "",
}: {
  rating: number;
  size?: number;
  // false: only the stars that are at least partly filled (homepage cards);
  // true: always five, with outlines for the part not earned.
  showEmpty?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex gap-0.5 text-gold-500 ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((value) => {
        const fill = Math.min(1, Math.max(0, rating - (value - 1)));
        if (fill >= 1) return <Star key={value} size={size} weight="fill" />;
        if (fill <= 0) {
          return showEmpty ? <Star key={value} size={size} weight="regular" /> : null;
        }
        return (
          <span
            key={value}
            className="relative inline-block"
            style={{ width: size, height: size }}
          >
            <Star size={size} weight="regular" className="absolute inset-0" />
            <span
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star size={size} weight="fill" className="max-w-none" />
            </span>
          </span>
        );
      })}
    </div>
  );
}
