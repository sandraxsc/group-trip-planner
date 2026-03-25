export interface TransitInfo {
  minutes: number;
  method: "walk" | "drive";
  source: "api" | "heuristic";
}

/**
 * Routes API (computeRoutes) is separate from Places API in Google Cloud.
 * Using only VITE_GOOGLE_PLACES_API_KEY causes 403 unless Routes API is enabled for that key.
 * We only call Routes when explicitly opted in so Places-only setups stay quiet and use heuristics.
 */
function getRoutesApiKey(): string | null {
  const routesKey = import.meta.env.VITE_GOOGLE_ROUTES_API_KEY as string | undefined;
  if (routesKey?.trim()) return routesKey.trim();
  const usePlacesKey =
    import.meta.env.VITE_GOOGLE_ROUTES_ENABLED === "true" ||
    import.meta.env.VITE_GOOGLE_ROUTES_ENABLED === "1";
  if (!usePlacesKey) return null;
  const places = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
  return places?.trim() ? places.trim() : null;
}

function parseDurationSeconds(duration?: string): number | null {
  if (!duration) return null;
  // Google returns values like "123s"
  const m = duration.match(/^(\d+)s$/);
  if (!m) return null;
  return Number(m[1]);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI / 180);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function fallbackTransit(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): TransitInfo {
  const km = haversineKm(origin, destination);
  if (km <= 1.2) {
    return { method: "walk", minutes: Math.max(5, Math.round((km / 4.5) * 60)), source: "heuristic" };
  }
  return { method: "drive", minutes: Math.max(8, Math.round((km / 30) * 60)), source: "heuristic" };
}

/**
 * Approx transit duration between two points (traffic-aware drive).
 * Falls back to a distance heuristic if API key is missing or request fails.
 */
export async function getApproxTransitInfo(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<TransitInfo> {
  const apiKey = getRoutesApiKey();
  if (!apiKey) return fallbackTransit(origin, destination);

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
        },
        destination: {
          location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });

    if (!res.ok) {
      if (import.meta.env.DEV && res.status === 403) {
        // eslint-disable-next-line no-console
        console.warn(
          "[transitService] Routes API 403 — enable \"Routes API\" for this key in Google Cloud, " +
            "or unset VITE_GOOGLE_ROUTES_ENABLED / VITE_GOOGLE_ROUTES_API_KEY to use distance-based estimates only."
        );
      }
      return fallbackTransit(origin, destination);
    }

    const data = (await res.json()) as {
      routes?: Array<{ duration?: string; distanceMeters?: number }>;
    };
    const route = data.routes?.[0];
    const seconds = parseDurationSeconds(route?.duration);
    if (!seconds) return fallbackTransit(origin, destination);
    const minutes = Math.max(3, Math.round(seconds / 60));
    const method: TransitInfo["method"] = (route?.distanceMeters ?? 0) <= 1200 ? "walk" : "drive";
    return { method, minutes, source: "api" };
  } catch {
    return fallbackTransit(origin, destination);
  }
}

