import { HouseLine } from "@phosphor-icons/react/dist/ssr";
import Eyebrow from "@/components/Eyebrow";

// Per master-color-scheme.md — the single source of truth for banner
// colors. Solid fills only, never gradients (contrast must hold at every
// point, and a gradient's lightest point is the one that tends to fail).
//
// Eyebrow and heading color are NOT always the same: the dark banners
// (Espresso, Forest) pair a Muted Gold eyebrow with an Ivory heading, but
// Terracotta/Gold/Sage are all too light-to-mid-toned for gold or white
// small text to clear 4.5:1 contrast — those get matching dark Espresso
// (or Ivory, for Terracotta specifically, since gold-on-terracotta reads
// poorly) text for both eyebrow and heading instead.
const BANNER_STYLES = {
  terracotta: {
    bg: "bg-terracotta-500",
    eyebrow: "text-ivory-dark",
    heading: "text-ivory-dark",
    icon: "text-espresso/40",
  },
  espresso: {
    bg: "bg-espresso dark:bg-[#1A1108]",
    eyebrow: "text-gold-500",
    heading: "text-ivory-dark",
    icon: "text-white/30",
  },
  forest: {
    bg: "bg-forest-500",
    eyebrow: "text-gold-500",
    heading: "text-ivory-dark",
    icon: "text-white/30",
  },
  gold: {
    bg: "bg-gold-500",
    eyebrow: "text-espresso",
    heading: "text-espresso",
    icon: "text-espresso/40",
  },
  sage: {
    bg: "bg-sage-500",
    eyebrow: "text-espresso",
    heading: "text-espresso",
    icon: "text-espresso/40",
  },
} as const;

export type BannerColor = keyof typeof BANNER_STYLES;

export default function PageBanner({
  color,
  eyebrow,
  title,
}: {
  color: BannerColor;
  eyebrow: string;
  title: string;
}) {
  const style = BANNER_STYLES[color];

  return (
    <section
      className={`relative flex h-64 w-full flex-col justify-end overflow-hidden pb-10 sm:h-80 ${style.bg}`}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <HouseLine size={32} weight="light" className={style.icon} />
      </div>
      <div className="container-page relative">
        <Eyebrow className={style.eyebrow}>{eyebrow}</Eyebrow>
        <h1 className={`mt-2 font-serif text-h1 ${style.heading}`}>{title}</h1>
      </div>
    </section>
  );
}
