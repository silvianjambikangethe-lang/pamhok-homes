import type { Metadata } from "next";
import { ForkKnife, Info, Ticket } from "@phosphor-icons/react/dist/ssr";
import PlaceholderImage from "@/components/PlaceholderImage";
import PageBanner from "@/components/PageBanner";

export const metadata: Metadata = {
  title: "Around the Neighborhood — Pamhok Homes",
  description:
    "Food and recreation near Pamhok Homes, close to Thika Road Mall, Nairobi.",
};

const FOOD = [
  {
    name: "Beatus Restaurant",
    detail: "Jewel Complex, next to TRM ground floor.",
  },
  {
    name: "Artcaffe",
    detail: "Casual cafe, good for coffee and breakfast.",
  },
  {
    name: "Café Kigwa",
    detail: "Kenyan cuisine at Safari Park Hotel, garden setting.",
  },
  {
    name: "Garden City Mall",
    detail: "Broader dining mix, including Ethiopian cuisine options.",
  },
];

const RECREATION = [
  {
    name: "TRM (Thika Road Mall)",
    detail: "Typically has a cinema and family entertainment inside the mall.",
  },
  {
    name: "Moi International Sports Centre, Kasarani",
    detail: "~7 min drive; sports events and activities.",
  },
  {
    name: "Sportsview Hotel Kasarani",
    detail: "Spa, pools, and a nightclub.",
  },
  {
    name: "Garden City Mall",
    detail: "Also has a waterpark — good for guests with kids.",
  },
];

export default function NeighborhoodPage() {
  return (
    <div>
      <PageBanner
        color="forest"
        eyebrow="Just outside your door"
        title="Around the Neighborhood"
      />

      <div className="container-page mt-8">
        <div className="flex items-start gap-3 rounded-2xl border border-gold-500/30 bg-gold-50 p-4 text-sm text-ink/80 dark:bg-gold-700/15">
          <Info size={20} className="mt-0.5 shrink-0 text-gold-700 dark:text-gold-300" />
          <p>
            Distances and drive times below are approximate — we&apos;ll
            confirm and adjust these once our exact address is finalized.
          </p>
        </div>
      </div>

      <section className="container-page py-12 sm:py-16">
        <div className="flex items-center gap-3">
          <ForkKnife size={26} className="text-terracotta-600" weight="light" />
          <h2 className="font-serif text-h2 text-ink">
            Food
          </h2>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {FOOD.map((item) => (
            <div
              key={item.name}
              className="flex gap-4 rounded-2xl border border-gold-500/20 bg-surface p-5 shadow-card"
            >
              <PlaceholderImage
                label={item.name}
                seed={item.name}
                className="h-20 w-20 shrink-0 rounded-xl"
              />
              <div>
                <p className="font-serif text-h3 text-ink">
                  {item.name}
                </p>
                <p className="mt-1 text-body-sm text-ink/65">
                  {item.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface py-12 sm:py-16">
        <div className="container-page">
          <div className="flex items-center gap-3">
            <Ticket size={26} className="text-terracotta-600" weight="light" />
            <h2 className="font-serif text-h2 text-ink">
              Recreation
            </h2>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {RECREATION.map((item) => (
              <div
                key={item.name}
                className="flex gap-4 rounded-2xl border border-gold-500/20 bg-page p-5 shadow-card"
              >
                <PlaceholderImage
                  label={item.name}
                  seed={item.name}
                  className="h-20 w-20 shrink-0 rounded-xl"
                />
                <div>
                  <p className="font-serif text-h3 text-ink">
                    {item.name}
                  </p>
                  <p className="mt-1 text-body-sm text-ink/65">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
