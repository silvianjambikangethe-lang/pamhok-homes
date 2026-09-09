import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// /portal and /verify carry an unguessable per-booking token in the URL —
// disallowing them here is defense in depth (they're already
// `robots: { index: false }` at the page level, see those routes' own
// metadata), not the only thing keeping them out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/staff", "/api", "/portal", "/verify"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
