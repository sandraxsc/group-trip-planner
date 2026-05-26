/**
 * Synchronous transit-time estimator.
 *
 * Intentionally API-free so callers can use it from render paths, planners,
 * and other hot loops without awaiting network calls. Returns a coarse
 * minute estimate based on the Haversine straight-line distance between two
 * geographic points, mapped to fixed travel-time buckets.
 *
 * Use this when a rough number is good enough; defer to the real transit
 * service (Routes API / heuristics) when accuracy matters.
 */

const EARTH_RADIUS_KM = 6371;

/** Degrees → radians. */
function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Straight-line distance in kilometers between two lat/lng points. */
function haversineDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Estimate transit time in minutes between two locations.
 *
 * Bucket mapping (Haversine straight-line distance):
 *  - missing endpoint   → 15 min (safe default)
 *  - < 1 km             →  5 min (walking)
 *  - 1 to < 3 km        → 15 min (short ride / long walk)
 *  - 3 to < 10 km       → 25 min (across-town transit)
 *  - ≥ 10 km            → 45 min (cross-city)
 */
export function estimateTransitMinutes(
  from: { lat: number; lng: number } | null | undefined,
  to: { lat: number; lng: number } | null | undefined
): number {
  if (
    !from ||
    !to ||
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lng) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lng)
  ) {
    return 15;
  }

  const km = haversineDistanceKm(from, to);
  if (km < 1) return 5;
  if (km < 3) return 15;
  if (km < 10) return 25;
  return 45;
}
