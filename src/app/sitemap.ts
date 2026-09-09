import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getRooms } from "@/lib/data";

// terms/privacy are deliberately excluded — both are already
// `robots: { index: false }` at the page level (boilerplate legal copy,
// not worth competing for search visibility), and listing a noindex page
// in the sitemap is contradictory. portal/[token] and verify/[token] are
// per-booking private pages, excluded for the same reason robots.ts
// disallows them.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { rooms } = await getRooms();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/rooms`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/amenities`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/neighborhood`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE.url}/contact`, changeFrequency: "yearly", priority: 0.4 },
  ];

  const roomPages: MetadataRoute.Sitemap = rooms.map((room) => ({
    url: `${SITE.url}/rooms/${room.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...roomPages];
}
