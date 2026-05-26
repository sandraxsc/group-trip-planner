import { getApiProxyBase } from "../config/apiProxy";

/** Same backend as AI proxy; dev defaults to http://127.0.0.1:3001. */
function getProxyBase(): string {
  return getApiProxyBase();
}

type DurationSource = "foursquare" | "heuristic";

interface FsqDurationCacheEntry {
  minutes: number;
  source: DurationSource;
}

// In-memory cache keyed by destination + name to avoid repeated calls.
const durationCache = new Map<string, FsqDurationCacheEntry>();

function buildCacheKey(name: string, destination: string, currentMinutes: number): string {
  return `${destination.toLowerCase()}|${name.toLowerCase()}|${currentMinutes}`;
}

/**
 * Try to extract a duration-like value (in minutes or hours) from a Foursquare place payload.
 * This is intentionally defensive: we support multiple possible field names and units.
 */
function extractDurationMinutesFromFsq(place: any): number | null {
  if (!place || typeof place !== "object") return null;

  const candidatePaths: string[] = [
    "duration",
    "visit_duration",
    "average_visit_duration",
    "avgVisitDuration",
    "avg_visit_length",
    "averageVisitLength",
  ];

  for (const path of candidatePaths) {
    if (Object.prototype.hasOwnProperty.call(place, path)) {
      const raw = (place as any)[path];
      if (typeof raw === "number" && raw > 0) {
        // Smarter unit heuristic:
        //  - non-integer (e.g. 1.5) → hours (Foursquare reports fractional hours)
        //  - small integer (≤ 8) → ambiguously hours (e.g. 2 = 2-hour museum), prefer hours
        //  - everything else → minutes
        if (raw !== Math.floor(raw)) return Math.round(raw * 60);
        if (raw <= 8) return Math.round(raw * 60);
        return Math.round(raw);
      }
    }
  }

  return null;
}

async function fetchFsqPlaceDetails(name: string, destination: string): Promise<any | null> {
  const base = getProxyBase();
  const searchPath = `/api/fsq/search?${new URLSearchParams({
    query: name,
    near: destination,
    limit: "1",
  }).toString()}`;

  try {
    const searchRes = await fetch(`${base}${searchPath}`, {
      headers: { Accept: "application/json" },
    });

    if (!searchRes.ok) {
      if (import.meta.env.DEV) {
        console.warn("[foursquare] proxy search failed, using heuristic", searchRes.status);
      }
      return null;
    }

    const searchJson = (await searchRes.json()) as any;

    const fsq = Array.isArray(searchJson.results) ? searchJson.results[0] : null;
    const fsqId = fsq?.fsq_id;
    if (!fsqId) return null;

    const detailsPath = `/api/fsq/places/${encodeURIComponent(fsqId)}`;
    const detailsRes = await fetch(`${base}${detailsPath}`, {
      headers: { Accept: "application/json" },
    });

    if (!detailsRes.ok) {
      if (import.meta.env.DEV) {
        console.warn("[foursquare] proxy details failed, using heuristic", detailsRes.status);
      }
      return null;
    }

    const detailsJson = (await detailsRes.json()) as any;
    if (import.meta.env.DEV) {
      console.log("[foursquare] details payload", detailsJson);
    }

    return detailsJson;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[foursquare] proxy unavailable, using heuristic", err);
    }
    return null;
  }
}

/**
 * Enrich an activity's duration using Foursquare when possible.
 * - Only uses Foursquare for duration (minutes)
 * - Returns either a Foursquare-based duration or the existing heuristic
 * - Results are cached by name + destination + currentMinutes
 */
export async function enrichDurationWithFoursquare(params: {
  name: string;
  destination: string;
  currentMinutes: number;
}): Promise<{ minutes: number; source: DurationSource }> {
  const { name, destination, currentMinutes } = params;

  const cacheKey = buildCacheKey(name, destination, currentMinutes);
  const cached = durationCache.get(cacheKey);
  if (cached) return { minutes: cached.minutes, source: cached.source };

  const details = await fetchFsqPlaceDetails(name, destination);
  const durationMinutes = extractDurationMinutesFromFsq(details);

  const result: FsqDurationCacheEntry =
    durationMinutes && durationMinutes > 0
      ? { minutes: durationMinutes, source: "foursquare" }
      : { minutes: currentMinutes, source: "heuristic" };

  durationCache.set(cacheKey, result);

  if (import.meta.env.DEV) {
    console.log("[foursquare] duration result", {
      name,
      destination,
      currentMinutes,
      durationFromFsq: durationMinutes,
      usedMinutes: result.minutes,
      source: result.source,
    });
  }

  return result;
}

