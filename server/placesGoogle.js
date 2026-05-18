/**
 * Google Places API (New) — server-side searchText for AI enrich (same surface as src/services/placeService.ts).
 */

import { fetchWithTimeout, isUpstreamTimeout } from "./fetchWithTimeout.js";

const PLACES_SEARCH_TEXT = "https://places.googleapis.com/v1/places:searchText";
const PLACES_TIMEOUT_MS = 10_000;

function normalizePlaceId(place) {
  const raw = place?.id ?? (typeof place?.name === "string" ? place.name.replace(/^places\//, "") : "");
  if (!raw) return null;
  return String(raw).replace(/^places\//, "");
}

/**
 * @param {{ apiKey: string; textQuery: string; includedType?: string | null; maxResultCount?: number }} opts
 * @returns {Promise<{ placeId: string; displayName: string } | null>}
 */
export async function searchTextFirstPlace(opts) {
  const apiKey = opts.apiKey?.trim();
  const textQuery = opts.textQuery?.trim();
  if (!apiKey || !textQuery) return null;

  const maxResultCount = Math.min(Math.max(opts.maxResultCount ?? 5, 1), 20);
  const body = { textQuery, maxResultCount };
  if (opts.includedType) body.includedType = opts.includedType;

  let res;
  try {
    res = await fetchWithTimeout(
      PLACES_SEARCH_TEXT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.name,places.displayName",
        },
        body: JSON.stringify(body),
      },
      PLACES_TIMEOUT_MS
    );
  } catch (e) {
    if (isUpstreamTimeout(e)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[placesGoogle] searchText upstream timeout");
      }
      return null;
    }
    throw e;
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (process.env.NODE_ENV !== "production") {
      console.warn("[placesGoogle] searchText failed", res.status, t.slice(0, 400));
    }
    return null;
  }

  const data = await res.json();
  const places = Array.isArray(data?.places) ? data.places : [];
  const p = places[0];
  if (!p) return null;
  const placeId = normalizePlaceId(p);
  const displayName = (p.displayName && p.displayName.text ? p.displayName.text : "").trim();
  if (!placeId || !displayName) return null;
  return { placeId, displayName };
}
