import type { CandidateActivity } from "../types/activity";
import type { MemberPreference } from "../types/preference";

function getApiKey(): string | null {
  const key = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
  return key && key.trim() ? key : null;
}

/**
 * Photo element from Places API (New) photos[] array.
 */
interface GooglePlacePhoto {
  name?: string;
  widthPx?: number;
  heightPx?: number;
}

/**
 * Raw place from Google Places API (New) searchText response.
 * Field names follow the API response shape.
 */
interface GooglePlaceSearchResult {
  id?: string;
  /** Resource name "places/PLACE_ID" when id is not present */
  name?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  rating?: number;
  priceLevel?: string;
  nationalPhoneNumber?: string;
  formattedAddress?: string;
  photos?: GooglePlacePhoto[];
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
  websiteUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
}

/**
 * Map Google price_level string to our cost level.
 */
function priceLevelToCostLevel(priceLevel?: string): "low" | "medium" | "high" {
  if (!priceLevel) return "medium";
  const p = priceLevel.toUpperCase();
  if (p === "FREE" || p === "PRICE_LEVEL_FREE" || p === "INEXPENSIVE") return "low";
  if (p === "EXPENSIVE" || p === "PRICE_LEVEL_EXPENSIVE") return "high";
  return "medium";
}

/**
 * Map Google types to intensity (heuristic).
 */
function typesToIntensity(types?: string[]): "low" | "medium" | "high" {
  if (!types?.length) return "medium";
  const t = types.join(" ").toLowerCase();
  if (/\b(gym|stadium|park|hiking|climbing|adventure)\b/.test(t)) return "high";
  if (/\b(spa|museum|library|art_gallery|park)\b/.test(t)) return "low";
  return "medium";
}

/**
 * Infer suitable time of day from place types (heuristic).
 */
function typesToSuitableTime(types?: string[]): ("morning" | "afternoon" | "evening")[] {
  if (!types?.length) return ["morning", "afternoon", "evening"];
  const t = types.join(" ").toLowerCase();
  if (/\b(night_club|bar)\b/.test(t)) return ["evening"];
  if (/\b(cafe|park)\b/.test(t)) return ["morning", "afternoon"];
  return ["morning", "afternoon", "evening"];
}

/**
 * Map Google place types to our tag set for deal-breaker matching.
 */
function typesToTags(types?: string[]): string[] {
  if (!types?.length) return [];
  const tags: string[] = [];
  const t = types.join(" ").toLowerCase();
  if (/\b(tourist_attraction|museum|shopping)\b/.test(t)) tags.push("crowded");
  if (/\b(rooftop|building|establishment)\b/.test(t) || /\b(mountain|park)\b/.test(t)) tags.push("heights");
  if (/\b(beach|aquarium|swimming|water)\b/.test(t)) tags.push("water");
  if (/\b(zoo|pet_store|aquarium)\b/.test(t)) tags.push("animals");
  if (/\b(restaurant|food)\b/.test(t)) tags.push("spicy"); // heuristic: food can be spicy
  if (/\b(transit_station|bus_station)\b/.test(t)) tags.push("long-travel");
  return [...new Set(tags)];
}

/**
 * Estimate duration in minutes from place type (heuristic).
 * museum → 2–3h, beach → 3–4h, landmark/viewpoint → 1h, temple → 1.5–2h, hiking → 3–4h.
 * Exported for use when enriching user-selected places from place details.
 */
export function typesToDurationMinutes(types?: string[]): number {
  if (!types?.length) return 120;
  const t = types.join(" ").toLowerCase();
  if (/\b(museum|art_gallery)\b/.test(t)) return 150; // 2–3h
  if (/\b(zoo)\b/.test(t)) return 180;
  if (/\b(beach|natural_feature)\b/.test(t)) return 210; // 3–4h
  if (/\b(tourist_attraction|point_of_interest|establishment)\b/.test(t) && !/\b(museum|park|beach|hiking|trail|restaurant|cafe|temple)\b/.test(t)) return 60; // landmark ~1h
  if (/\b(temple|place_of_worship|hindu_temple)\b/.test(t)) return 105; // 1.5–2h
  if (/\b(park)\b/.test(t)) return 120;
  if (/\b(hiking|trail|campground)\b/.test(t)) return 210; // 3–4h
  if (/\b(restaurant|cafe|meal_takeaway|meal_delivery)\b/.test(t)) return 90;
  if (/\b(bar|night_club)\b/.test(t)) return 120;
  if (/\b(shopping_mall|store)\b/.test(t)) return 150;
  return 120;
}

/**
 * Convert one Google Place search result to CandidateActivity.
 * Pass apiKey to build real photo URL when photos are present.
 */
function googlePlaceToCandidateActivity(
  place: GooglePlaceSearchResult,
  apiKey?: string | null
): CandidateActivity {
  const placeId = place.id ?? (place.name?.replace(/^places\//, "") ?? "");
  const name = place.displayName?.text ?? "Unnamed place";
  const types = place.types ?? [];
  const lat = place.location?.latitude ?? 0;
  const lng = place.location?.longitude ?? 0;
  const primaryDisplay = place.primaryTypeDisplayName?.text;
  const firstPhoto = place.photos?.[0]?.name;

  let imageUrl: string | undefined;
  if (firstPhoto && apiKey) {
    imageUrl = buildPlacePhotoUrl(firstPhoto, apiKey);
  }

  return {
    placeId,
    name,
    location: lat !== 0 || lng !== 0 ? { lat, lng } : undefined,
    categories: types,
    rating: place.rating,
    priceLevel: place.priceLevel ? parsePriceLevel(place.priceLevel) : undefined,
    estimatedDuration: typesToDurationMinutes(types),
    costLevel: priceLevelToCostLevel(place.priceLevel),
    intensity: typesToIntensity(types),
    suitableTime: typesToSuitableTime(types),
    tags: typesToTags(types),
    source: "system_recommended",
    imageUrl,
    description: buildDescription(name, types, place.editorialSummary?.text),
    displayCategoryLabel: typesToCategoryLabel(types, primaryDisplay),
  };
}

/** Parse Google price level string to 0-4 number if possible. */
function parsePriceLevel(priceLevel: string): number {
  const p = priceLevel.toUpperCase();
  if (p === "FREE" || p === "PRICE_LEVEL_FREE") return 0;
  if (p === "INEXPENSIVE" || p === "PRICE_LEVEL_INEXPENSIVE") return 1;
  if (p === "MODERATE" || p === "PRICE_LEVEL_MODERATE") return 2;
  if (p === "EXPENSIVE" || p === "PRICE_LEVEL_EXPENSIVE") return 3;
  return 2;
}

/**
 * Build a direct photo URL for Places API (New). Client uses this as img src; API redirects to image.
 */
function buildPlacePhotoUrl(photoName: string, apiKey: string, maxPx = 600): string {
  const base = "https://places.googleapis.com/v1";
  const path = photoName.startsWith("places/") ? photoName : `places/${photoName}`;
  return `${base}/${path}/media?maxWidthPx=${maxPx}&key=${apiKey}`;
}

/**
 * Map Google types to a single display category label for cards.
 */
function typesToCategoryLabel(types?: string[], primaryTypeDisplayName?: string): string {
  const primary = primaryTypeDisplayName?.trim();
  if (primary) return primary;
  if (!types?.length) return "Activity";
  const t = types.join(" ").toLowerCase();
  const mapping: [RegExp, string][] = [
    [/\bmuseum\b/, "Museum"],
    [/\bart_gallery\b/, "Art & Culture"],
    [/\bbeach\b/, "Beach"],
    [/\btemple\b|\bplace_of_worship\b|\bhindu_temple\b/, "Temple"],
    [/\bpark\b/, "Park"],
    [/\bnatural_feature\b/, "Nature"],
    [/\bhiking\b|\btrail\b|\bcampground\b/, "Hiking & Outdoors"],
    [/\brestaurant\b|\bfood\b|\bcafe\b/, "Food & Drink"],
    [/\bnight_club\b|\bbar\b/, "Nightlife"],
    [/\bshopping_mall\b|\bstore\b/, "Shopping"],
    [/\bzoo\b|\baquarium\b/, "Wildlife"],
    [/\btourist_attraction\b/, "Attraction"],
    [/\bviewpoint\b/, "Viewpoint"],
    [/\bstadium\b|\bgym\b/, "Sports"],
    [/\bspa\b/, "Wellness"],
  ];
  for (const [re, label] of mapping) {
    if (re.test(t)) return label;
  }
  return "Activity";
}

/**
 * Short description from API summary or generated from types + name.
 */
function buildDescription(
  displayName: string,
  types?: string[],
  editorialSummary?: string
): string {
  const summary = editorialSummary?.trim();
  if (summary) return summary;
  const label = typesToCategoryLabel(types);
  if (label && label !== "Activity") return `${label} — explore ${displayName}.`;
  return `Explore ${displayName}.`;
}

const DEFAULT_PLACE_IMAGE =
  "https://images.unsplash.com/photo-1516426122078-c23e76319801?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

/**
 * Fetch places for a destination via Google Places API (New) searchText.
 * Returns structured CandidateActivity list. Returns [] if API key missing or request fails.
 */
export async function fetchPlacesForDestination(params: {
  destination: string;
  maxResults?: number;
  /** Override the default "destination + tourist attractions" query to get different results (e.g. "destination restaurants"). */
  textQueryOverride?: string;
  /** Full Places searchText query (destination + override ignored when set). */
  textQuery?: string;
  signal?: AbortSignal;
}): Promise<CandidateActivity[]> {
  const { destination, maxResults = 20, textQueryOverride, textQuery, signal } = params;
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const query = textQuery?.trim()
    ? textQuery.trim()
    : textQueryOverride?.trim()
      ? `${destination} ${textQueryOverride}`
      : `${destination} tourist attractions things to do`;
  const url = "https://places.googleapis.com/v1/places:searchText";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.name,places.displayName,places.location,places.types,places.rating,places.priceLevel,places.photos,places.primaryTypeDisplayName,places.editorialSummary",
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: Math.min(maxResults, 20),
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[placeService] searchText failed", res.status, text);
      return [];
    }

    const data = (await res.json()) as { places?: GooglePlaceSearchResult[] };
    const places = data.places ?? [];
    return places
      .filter((p) => (p.id || p.name) && (p.displayName?.text ?? "").trim())
      .map((p) => {
        const activity = googlePlaceToCandidateActivity(p, apiKey);
        if (!activity.imageUrl) activity.imageUrl = DEFAULT_PLACE_IMAGE;
        return activity;
      });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    console.warn("[placeService] fetch error", err);
    return [];
  }
}

/** Maps preference activity ids → natural-language hints for Places searchText */
const ACTIVITY_SEARCH_HINTS: Record<string, string> = {
  beach: "beach shoreline seaside",
  hiking: "hiking trails viewpoints nature walks",
  culture: "museums art galleries cultural attractions",
  food: "local restaurants street food famous eateries",
  nightlife: "nightlife bars nightlife venues",
  shopping: "shopping markets boutiques malls",
  spa: "spa wellness massage relaxation",
  adventure: "adventure outdoor activities zipline rafting",
  photography: "scenic viewpoints panoramic photo spots",
  wildlife: "wildlife zoo aquarium nature reserve",
  history: "historic landmarks monuments heritage sites",
  water: "water sports snorkeling diving kayaking beaches",
};

function energySearchPhrase(energy?: MemberPreference["energyLevel"]): string {
  if (energy === "low") return "relaxing scenic easy walks";
  if (energy === "high") return "active outdoor adventurous hiking trails";
  return "popular things to do";
}

function budgetSearchPhrase(budget?: MemberPreference["budgetLevel"]): string {
  if (budget === "budget") return "budget-friendly affordable";
  if (budget === "luxury") return "luxury upscale iconic premium";
  return "";
}

/** Google Places types that are booking desks, not standalone activities — hide from preference recommendations. */
const EXCLUDED_PREFERENCE_RECOMMENDATION_PLACE_TYPES = new Set(["travel_agency"]);

function isExcludedFromPreferenceRecommendations(candidate: CandidateActivity): boolean {
  const typesLower = new Set((candidate.categories ?? []).map((x) => x.toLowerCase()));
  for (const ex of EXCLUDED_PREFERENCE_RECOMMENDATION_PLACE_TYPES) {
    if (typesLower.has(ex)) return true;
  }
  const label = (candidate.displayCategoryLabel ?? "").toLowerCase();
  if (label.includes("tour agency") || label.includes("travel agency")) return true;
  return false;
}

function mergeCandidatesByRatingDesc(candidates: CandidateActivity[], limit: number): CandidateActivity[] {
  const byId = new Map<string, CandidateActivity>();
  for (const c of candidates) {
    const id = c.placeId;
    if (!id) continue;
    const prev = byId.get(id);
    const score = (r?: number) => (typeof r === "number" ? r : -1);
    if (!prev || score(c.rating) > score(prev.rating)) byId.set(id, c);
  }
  const list = [...byId.values()].sort((a, b) => {
    const ra = typeof a.rating === "number" ? a.rating : -1;
    const rb = typeof b.rating === "number" ? b.rating : -1;
    return rb - ra;
  });
  return list.slice(0, Math.max(1, limit));
}

/**
 * Personalized recommendations for the preference flow (step 5 search screen).
 * Uses trip destination + prior preference answers; returns top `limit` by Google user rating.
 */
export async function fetchPersonalizedPlaceRecommendations(params: {
  destination: string;
  prefs: Partial<MemberPreference> | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CandidateActivity[]> {
  const dest = params.destination?.trim();
  if (!dest) return [];

  const prefs = params.prefs ?? {};
  const limit = params.limit ?? 7;
  const signal = params.signal;

  const activityHints =
    (prefs.activityTypes ?? [])
      .map((id) => ACTIVITY_SEARCH_HINTS[id])
      .filter(Boolean)
      .join(" ")
      .trim() || "";

  const energy = energySearchPhrase(prefs.energyLevel);
  const budget = budgetSearchPhrase(prefs.budgetLevel).trim();

  const queries: string[] = [];
  const primaryParts = [
    dest,
    activityHints,
    energy,
    budget,
    "highly rated attractions activities",
  ].filter(Boolean);
  queries.push(primaryParts.join(" "));

  if (!activityHints) {
    queries.push(`${dest} top rated tourist attractions landmarks museums`);
  } else {
    queries.push(`${dest} highly rated ${energy}`);
  }

  const merged: CandidateActivity[] = [];
  const seenInBatch = new Set<string>();

  for (const q of queries) {
    const chunk = await fetchPlacesForDestination({
      destination: "",
      textQuery: q,
      maxResults: 20,
      signal,
    });
    for (const c of chunk) {
      if (seenInBatch.has(c.placeId)) continue;
      if (isExcludedFromPreferenceRecommendations(c)) continue;
      seenInBatch.add(c.placeId);
      merged.push(c);
    }
    if (merged.length >= limit * 3) break;
  }

  return mergeCandidatesByRatingDesc(merged, limit);
}

/**
 * Result of fetching details for a single place (e.g. for photo or display).
 */
export interface PlaceDetailsResult {
  placeId: string;
  name: string;
  imageUrl: string | null;
  displayCategoryLabel: string | null;
  description: string | null;
  types: string[];
  rating?: number;
  formattedAddress?: string;
  phone?: string;
  website?: string;
  openHoursText?: string[];
  openNow?: boolean;
  priceLevel?: number;
  costLevel: "low" | "medium" | "high";
  estimatedDurationMinutes: number;
}

/**
 * Fetch place details by place ID (e.g. from autocomplete). Used to get real photo and labels for user-selected places.
 */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
  const apiKey = getApiKey();
  if (!apiKey || !placeId.trim()) return null;

  const id = placeId.replace(/^places\//, "");
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,photos,types,primaryTypeDisplayName,editorialSummary,priceLevel,rating,formattedAddress,nationalPhoneNumber,websiteUri,regularOpeningHours",
      },
    });

    if (!res.ok) return null;

    const place = (await res.json()) as GooglePlaceSearchResult;
    const name = place.displayName?.text ?? "";
    const types = place.types ?? [];
    const primaryDisplay = place.primaryTypeDisplayName?.text;
    const firstPhoto = place.photos?.[0]?.name;

    let imageUrl: string | null = null;
    if (firstPhoto) {
      imageUrl = buildPlacePhotoUrl(firstPhoto, apiKey);
    }

    return {
      placeId: place.id ?? id,
      name,
      imageUrl,
      displayCategoryLabel: typesToCategoryLabel(types, primaryDisplay) || null,
      description: buildDescription(name, types, place.editorialSummary?.text) || null,
      types,
      rating: place.rating,
      formattedAddress: place.formattedAddress,
      phone: place.nationalPhoneNumber,
      website: place.websiteUri,
      openHoursText: place.regularOpeningHours?.weekdayDescriptions,
      openNow: place.regularOpeningHours?.openNow,
      priceLevel: place.priceLevel ? parsePriceLevel(place.priceLevel) : undefined,
      costLevel: priceLevelToCostLevel(place.priceLevel),
      estimatedDurationMinutes: typesToDurationMinutes(types),
    };
  } catch {
    return null;
  }
}

/** One row for hotel / lodging autocomplete (Places API searchText). */
export interface HotelPlaceSuggestion {
  placeId: string;
  name: string;
  formattedAddress?: string;
}

/**
 * Lodging-oriented place suggestions as the user types (Places API New searchText).
 * Returns [] if API key is missing, query too short, or the request fails.
 */
export async function fetchHotelPlaceSuggestions(params: {
  query: string;
  /** Trip destination; biases results (e.g. city or region name). */
  destination?: string;
  maxResults?: number;
  signal?: AbortSignal;
}): Promise<HotelPlaceSuggestion[]> {
  const { query, destination = "", maxResults = 8, signal } = params;
  const apiKey = getApiKey();
  const q = query.trim();
  if (!apiKey || q.length < 2) return [];

  const dest = destination.trim();
  const textQuery = dest ? `${q} hotel lodging ${dest}` : `${q} hotel lodging`;
  const url = "https://places.googleapis.com/v1/places:searchText";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.name,places.displayName,places.formattedAddress,places.types",
      },
      body: JSON.stringify({
        textQuery,
        pageSize: Math.min(Math.max(maxResults, 1), 20),
        includedType: "lodging",
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[placeService] hotel searchText failed", res.status, text);
      return [];
    }

    const data = (await res.json()) as { places?: GooglePlaceSearchResult[] };
    const places = data.places ?? [];
    const out: HotelPlaceSuggestion[] = [];
    for (const p of places) {
      const placeId = p.id ?? p.name?.replace(/^places\//, "") ?? "";
      const name = (p.displayName?.text ?? "").trim();
      if (!placeId || !name) continue;
      out.push({
        placeId,
        name,
        formattedAddress: p.formattedAddress?.trim() || undefined,
      });
    }
    return out;
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    console.warn("[placeService] hotel suggestions fetch error", err);
    return [];
  }
}
