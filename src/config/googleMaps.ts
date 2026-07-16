/**
 * Google Maps JavaScript API key (trip plan map view). Separate from
 * VITE_GOOGLE_PLACES_API_KEY / VITE_GOOGLE_ROUTES_API_KEY since "Maps
 * JavaScript API" is its own enablement flag in GCP — but the same key value
 * works fine here if that flag is turned on for it.
 */
export function getGoogleMapsApiKey(): string | null {
  const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  return key ? key : null;
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey() != null;
}
