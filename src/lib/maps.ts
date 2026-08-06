// Google Maps share links (short maps.app.goo.gl links or full
// google.com/maps URLs) encode the pinned point's coordinates in a few
// different ways depending on how the link was generated. Tried in order
// of precision/reliability; the first match wins.
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

// Follows redirects on a Google Maps share link (e.g. maps.app.goo.gl/xxx)
// to reach the final URL, then pulls the pinned coordinates out of it.
export async function resolveMapsLink(
  url: string,
): Promise<{ lat: number; lng: number } | null> {
  let resolvedUrl: string;
  try {
    const res = await fetch(url, { redirect: "follow" });
    resolvedUrl = res.url;
  } catch {
    return null;
  }
  return extractLatLng(resolvedUrl);
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
