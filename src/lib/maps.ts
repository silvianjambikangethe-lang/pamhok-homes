// Google Maps share links (short maps.app.goo.gl links or full
// google.com/maps URLs) encode the pinned point's coordinates in a few
// different ways depending on how the link was generated. Tried in order
// of precision/reliability; the first match wins.
//
// Note: the "@lat,lng,zoom" pattern is only reliable on a plain place-view
// URL, where it IS the pin. On a /maps/dir/ (directions) URL it's the map
// viewport's camera center for the route, not the destination — so it must
// never be used there. resolveMapsLink() checks for a directions URL and
// short-circuits before this ambiguity can bite.
const COORD_PATTERNS = [
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // place detail permalink (most precise)
  /@(-?\d+\.\d+),(-?\d+\.\d+),/, // map view URL with a zoom level
  /\/place\/(-?\d+\.\d+),(-?\d+\.\d+)/, // bare-coordinate place URL
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, // simple query-string link
];

export function extractLatLng(url: string): { lat: number; lng: number } | null {
  for (const pattern of COORD_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
  }
  return null;
}

export type ResolvedMapsLink =
  | { kind: "coords"; lat: number; lng: number }
  | { kind: "directions"; directionsUrl: string };

// Follows redirects on a Google Maps share link (e.g. maps.app.goo.gl/xxx)
// to reach the final URL. Two shapes are supported:
//  - a plain pin/place link -> pull its coordinates out, so a directions
//    route can be built from them later (see buildDirectionsUrl)
//  - an already-complete "from A to B" directions link (e.g. one shared
//    straight from Google Maps' own Directions feature) -> use Google's
//    resolved route URL as-is, since it's more precise than anything we'd
//    reconstruct from extracted coordinates
export async function resolveMapsLink(url: string): Promise<ResolvedMapsLink | null> {
  let resolvedUrl: string;
  try {
    const res = await fetch(url, { redirect: "follow" });
    resolvedUrl = res.url;
  } catch {
    return null;
  }

  if (resolvedUrl.includes("/maps/dir/")) {
    return { kind: "directions", directionsUrl: resolvedUrl };
  }

  const coords = extractLatLng(resolvedUrl);
  if (!coords) return null;
  return { kind: "coords", lat: coords.lat, lng: coords.lng };
}

export function buildDirectionsUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): string {
  const origin = `${originLat},${originLng}`;
  const destination = `${destLat},${destLng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
}
