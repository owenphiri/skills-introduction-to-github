/**
 * Waze deep links (deliverable: live tracking & mapping).
 * On phones with Waze installed these open the app directly and start
 * navigation; otherwise the Waze web map opens. No API key required.
 * https://developers.google.com/waze/deeplinks
 */
export function wazeNavigateUrl(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export function wazeSearchUrl(query: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
}

/** Google Maps fallback for users without Waze. */
export function gmapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Static OpenStreetMap embed for the farm map page — zero keys, zero cost. */
export function osmEmbedUrl(lat: number, lng: number, zoom = 13) {
  const d = 0.02 * (19 - zoom);
  const bbox = [lng - d, lat - d, lng + d, lat + d].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}
