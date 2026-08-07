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
  // Unchanged — not part of the light-mode banner revision (Privacy,
  // Terms, and any other page not in the master-color-scheme.md table).
  espresso: {
    bg: "bg-espresso dark:bg-[#1A1108]",
    eyebrow: "text-gold-500",
    heading: "text-ivory-dark",
    icon: "text-white/30",
  },
  // Neighborhood. bg/eyebrow already matched the revised palette exactly
  // (Deep Forest #3B4A3A, Muted Gold) — only heading text moves to mousse.
  forest: {
    bg: "bg-forest-500",
    eyebrow: "text-gold-500",
    heading: "text-mousse dark:text-ivory-dark",
    icon: "text-white/30",
  },
  // Rooms & Availability. bg already matched (Muted Gold) — text moves to
  // cocoa, dark preserved as the espresso it already was.
  gold: {
    bg: "bg-gold-500",
    eyebrow: "text-cocoa dark:text-espresso",
    heading: "text-cocoa dark:text-espresso",
    icon: "text-cocoa/40 dark:text-espresso/40",
  },
  // Unchanged — verify/[token] only, not part of the light-mode banner
  // revision (Guest Portal moved to taupePortal below instead).
  sage: {
    bg: "bg-sage-500",
    eyebrow: "text-espresso",
    heading: "text-espresso",
    icon: "text-espresso/40",
  },
  // About Us, Contact & Location. Same dark treatment as the old espresso
  // variant these replace (#1A1108 bg, gold eyebrow, ivory heading) — only
  // the light-mode bg/text move to Rich Cocoa / Creamy Mousse.
  cocoa: {
    bg: "bg-cocoa dark:bg-[#1A1108]",
    eyebrow: "text-gold-500",
    heading: "text-mousse dark:text-ivory-dark",
    icon: "text-white/30",
  },
  // Amenities. Espresso bg with Ivory/Creamy Mousse text for both eyebrow
  // and heading (not the gold-eyebrow espresso pairing used elsewhere).
  espressoAmenities: {
    bg: "bg-espresso dark:bg-[#1A1108]",
    eyebrow: "text-mousse dark:text-gold-500",
    heading: "text-mousse dark:text-ivory-dark",
    icon: "text-white/30",
  },
  // Guest Portal. Same dark treatment as the old sage variant this
  // replaces (sage bg, espresso text, unchanged between modes already).
  taupePortal: {
    bg: "bg-[#A7866A] dark:bg-sage-500",
    eyebrow: "text-cocoa dark:text-espresso",
    heading: "text-cocoa dark:text-espresso",
    icon: "text-cocoa/40 dark:text-espresso/40",
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
