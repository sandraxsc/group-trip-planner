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

/** Google Routes returns 400 (not 403) for invalid lat/lng or invalid API key. */
function isUsableRouteLatLng(p: { lat: number; lng: number }): boolean {
  const { lat, lng } = p;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Fix common Tokyo-style swap (lng ~139 stored as latitude). */
function normalizeRouteLatLng(p: { lat: number; lng: number }): { lat: number; lng: number } {
  if (isUsableRouteLatLng(p)) return p;
  if (
    Math.abs(p.lat) > 90 &&
    Math.abs(p.lat) <= 180 &&
    Math.abs(p.lng) <= 90 &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng)
  ) {
    const swapped = { lat: p.lng, lng: p.lat };
    if (isUsableRouteLatLng(swapped)) return swapped;
  }
  return p;
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

/** Fast estimate without calling Routes API (use for non-focused days to save quota). */
export function getHeuristicTransitInfo(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): TransitInfo {
  return fallbackTransit(origin, destination);
}

function routePairKey(a: { lat: number; lng: number }, b: { lat: number; lng: number }): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(a.lat)},${r(a.lng)}→${r(b.lat)},${r(b.lng)}`;
}

const routesResultCache = new Map<string, TransitInfo>();
const routesInFlight = new Map<string, Promise<TransitInfo>>();
const ROUTES_CACHE_MAX = 400;
const TRANSIT_ROUTES_STORAGE_KEY = "gtp_transit_routes_v1";

function loadTransitRoutesFromStorage() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(TRANSIT_ROUTES_STORAGE_KEY) : null;
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, TransitInfo>;
    if (!obj || typeof obj !== "object") return;
    routesResultCache.clear();
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v.minutes === "number" && (v.method === "walk" || v.method === "drive")) {
        routesResultCache.set(k, v);
      }
    }
    while (routesResultCache.size > ROUTES_CACHE_MAX) {
      const first = routesResultCache.keys().next().value;
      if (first) routesResultCache.delete(first);
      else break;
    }
  } catch {
    /* ignore */
  }
}

function persistTransitRoutesSync() {
  try {
    if (typeof localStorage === "undefined") return;
    const obj: Record<string, TransitInfo> = {};
    let i = 0;
    for (const [k, v] of routesResultCache) {
      if (i >= ROUTES_CACHE_MAX) break;
      obj[k] = v;
      i++;
    }
    localStorage.setItem(TRANSIT_ROUTES_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* quota */
  }
}

let persistTransitScheduled: ReturnType<typeof setTimeout> | null = null;
function schedulePersistTransitRoutes() {
  if (persistTransitScheduled != null) clearTimeout(persistTransitScheduled);
  persistTransitScheduled = setTimeout(() => {
    persistTransitScheduled = null;
    persistTransitRoutesSync();
  }, 750);
}

loadTransitRoutesFromStorage();

function cacheRoutesResult(key: string, value: TransitInfo) {
  if (routesResultCache.size >= ROUTES_CACHE_MAX) {
    const first = routesResultCache.keys().next().value;
    if (first) routesResultCache.delete(first);
  }
  routesResultCache.set(key, value);
  schedulePersistTransitRoutes();
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
  const o = normalizeRouteLatLng(origin);
  const d = normalizeRouteLatLng(destination);
  if (!apiKey || !isUsableRouteLatLng(o) || !isUsableRouteLatLng(d)) {
    return fallbackTransit(o, d);
  }

  const key = routePairKey(o, d);
  const hit = routesResultCache.get(key);
  if (hit) return hit;

  const pending = routesInFlight.get(key);
  if (pending) return pending;

  const promise = (async (): Promise<TransitInfo> => {
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
            location: { latLng: { latitude: o.lat, longitude: o.lng } },
          },
          destination: {
            location: { latLng: { latitude: d.lat, longitude: d.lng } },
          },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      });

      if (!res.ok) {
        if (import.meta.env.DEV && (res.status === 400 || res.status === 403)) {
          const errText = await res.text().catch(() => "");
          // eslint-disable-next-line no-console
          console.warn(
            `[transitService] Routes API ${res.status}`,
            errText.slice(0, 400) ||
              (res.status === 403
                ? "Enable Routes API on this key or unset VITE_GOOGLE_ROUTES_ENABLED."
                : "Check API key, lat/lng on itinerary stops, and Routes API billing.")
          );
        }
        const fb = fallbackTransit(o, d);
        cacheRoutesResult(key, fb);
        return fb;
      }

      const data = (await res.json()) as {
        routes?: Array<{ duration?: string; distanceMeters?: number }>;
      };
      const route = data.routes?.[0];
      const seconds = parseDurationSeconds(route?.duration);
      if (!seconds) {
        const fb = fallbackTransit(o, d);
        cacheRoutesResult(key, fb);
        return fb;
      }
      const minutes = Math.max(3, Math.round(seconds / 60));
      const method: TransitInfo["method"] = (route?.distanceMeters ?? 0) <= 1200 ? "walk" : "drive";
      const out: TransitInfo = { method, minutes, source: "api" };
      cacheRoutesResult(key, out);
      return out;
    } catch {
      const fb = fallbackTransit(o, d);
      cacheRoutesResult(key, fb);
      return fb;
    } finally {
      routesInFlight.delete(key);
    }
  })();

  routesInFlight.set(key, promise);
  return promise;
}

