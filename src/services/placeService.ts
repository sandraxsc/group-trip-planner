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
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
    /**
     * Structured periods. The Places API uses day index 0=Sunday..6=Saturday.
     * If `close` is omitted, the venue is open 24h on that day starting at `open`.
     * A period whose `close.day` differs from `open.day` represents a window that
     * crosses midnight (e.g. bar open Fri 20:00 -> Sat 02:00).
     */
    periods?: Array<{
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }>;
  };
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
  // Complete heuristic duration map (first match wins). Rules are evaluated
  // top-to-bottom; order is intentionally specific → generic.
  const typeSet = new Set((types ?? []).map((x) => x.toLowerCase().trim()).filter(Boolean));

  const hasAny = (candidates: string[]) => candidates.some((c) => typeSet.has(c));

  // If no match / empty, default to 60 (per spec).
  if (typeSet.size === 0) return 60;

  // 1–16 (long-form experiences)
  if (hasAny(["ski_resort"])) return 360;
  if (hasAny(["amusement_park", "theme_park"])) return 360;
  if (hasAny(["water_park"])) return 300;
  if (hasAny(["childrens_camp"])) return 300;
  if (hasAny(["national_park", "state_park"])) return 240;
  if (hasAny(["fishing_charter"])) return 240;
  if (hasAny(["hunting_area"])) return 240;
  if (hasAny(["wedding_venue"])) return 240;
  if (hasAny(["zoo"])) return 180;
  if (hasAny(["performing_arts_theater", "opera_house", "concert_hall"])) return 180;
  if (hasAny(["stadium", "arena"])) return 180;
  if (hasAny(["casino"])) return 180;
  if (hasAny(["racetrack"])) return 180;
  if (hasAny(["off_roading_area", "snowmobile_park"])) return 180;
  if (hasAny(["adventure_sports_center"])) return 180;
  if (hasAny(["golf_course"])) return 180;

  // 17–19 (outdoors / anchor categories)
  if (hasAny(["hiking_area", "trail", "campground"])) return 210;
  if (hasAny(["beach", "natural_feature", "rv_park"])) return 210;
  if (hasAny(["banquet_hall", "convention_center", "event_venue"])) return 180;

  // 20–39
  if (hasAny(["wildlife_refuge", "wildlife_sanctuary"])) return 150;
  if (hasAny(["museum", "art_gallery"])) return 150;
  if (hasAny(["movie_theater", "cinema"])) return 150;
  if (hasAny(["rock_climbing_area", "climbing_gym"])) return 150;
  if (hasAny(["night_club"])) return 150;
  if (hasAny(["aquarium"])) return 120;
  if (hasAny(["amphitheater"])) return 120;
  if (hasAny(["amusement_center"])) return 120;
  if (hasAny(["botanical_garden"])) return 120;
  if (hasAny(["cycling_park"])) return 120;
  if (hasAny(["dance_hall"])) return 120;
  if (hasAny(["fishing_pond"])) return 120;
  if (hasAny(["horse_riding_area", "equestrian"])) return 120;
  if (hasAny(["karaoke"])) return 120;
  if (hasAny(["paintball_center"])) return 120;
  if (hasAny(["sports_complex"])) return 120;
  if (hasAny(["swimming_area", "swimming_pool"])) return 120;
  if (hasAny(["cultural_center"])) return 120;
  if (hasAny(["shopping_mall"])) return 120;
  if (hasAny(["fine_dining_restaurant"])) return 120;

  // 40–59 (shorter / common)
  if (hasAny(["spa"])) return 90;
  if (hasAny(["beauty_salon", "hair_care", "hair_salon"])) return 90;
  if (hasAny(["bowling_alley"])) return 90;
  if (hasAny(["bar", "pub", "wine_bar", "bar_and_grill"])) return 90;
  if (hasAny(["brewery", "winery", "distillery"])) return 90;
  if (hasAny(["comedy_club"])) return 90;
  if (hasAny(["escape_room"])) return 90;
  if (hasAny(["video_arcade"])) return 90;
  if (hasAny(["skate_park"])) return 90;
  if (hasAny(["ice_skating_rink"])) return 90;
  if (hasAny(["tennis_court", "squash"])) return 90;
  if (hasAny(["athletic_field"])) return 90;
  if (hasAny(["recreation_center", "community_center"])) return 90;
  if (hasAny(["picnic_ground", "barbecue_area"])) return 90;
  if (hasAny(["seafood_restaurant", "steak_house", "barbecue_restaurant"])) return 90;
  if (hasAny(["market", "street_market", "flea_market"])) return 90;
  if (hasAny(["park"])) return 90;
  if (hasAny(["fitness_center", "gym", "sports_club", "sports_coaching", "sports_activity_location"])) return 75;
  if (hasAny(["buffet_restaurant"])) return 75;
  if (hasAny(["restaurant", "meal_delivery", "meal_takeaway", "diner"])) return 75;

  // 60–103 (errands / short stops / transit)
  if (hasAny(["laser_tag_center"])) return 60;
  if (hasAny(["go_kart_track"])) return 60;
  if (hasAny(["mini_golf", "miniature_golf"])) return 60;
  if (hasAny(["nail_salon"])) return 60;
  if (hasAny(["department_store", "clothing_store", "shoe_store", "jewelry_store"])) return 60;
  if (hasAny(["outdoor_sports_store", "sporting_goods_store"])) return 60;
  if (hasAny(["furniture_store", "home_goods_store", "home_improvement_store"])) return 60;
  if (hasAny(["playground"])) return 60;
  if (hasAny(["dog_park"])) return 60;
  if (hasAny(["hindu_temple", "buddhist_temple", "mosque", "church", "synagogue", "jain_temple", "shinto_shrine", "place_of_worship", "temple"])) return 60;
  if (hasAny(["library"])) return 60;
  if (hasAny(["marina"])) return 60;
  if (hasAny(["airport"])) return 60;
  if (hasAny(["hospital", "dental_clinic", "doctor", "physiotherapist", "veterinary"])) return 60;
  if (hasAny(["city_hall", "courthouse", "embassy", "local_government_office"])) return 45;
  if (hasAny(["historical_landmark", "monument", "sculpture", "ruins"])) return 45;
  if (hasAny(["observation_deck"])) return 45;
  if (hasAny(["cafe", "coffee_shop", "bakery", "tea_house"])) return 45;
  if (hasAny(["book_store"])) return 45;
  if (hasAny(["electronics_store", "cell_phone_store"])) return 45;
  if (hasAny(["gift_shop", "toy_store"])) return 45;
  if (hasAny(["barber_shop"])) return 45;
  if (hasAny(["car_rental"])) return 30;
  if (hasAny(["car_wash"])) return 30;
  if (hasAny(["electric_vehicle_charging_station"])) return 25;
  if (hasAny(["visitor_center"])) return 30;
  if (hasAny(["post_office"])) return 20;
  if (hasAny(["grocery_store", "supermarket", "convenience_store"])) return 30;
  if (hasAny(["pet_store"])) return 30;
  if (hasAny(["store", "discount_store", "wholesale_store"])) return 30;
  if (hasAny(["fast_food_restaurant"])) return 30;
  if (hasAny(["ice_cream_shop", "dessert_shop", "juice_shop", "candy_store", "donut_shop", "acai_shop"])) return 20;
  if (hasAny(["liquor_store"])) return 20;
  if (hasAny(["florist"])) return 20;
  if (hasAny(["pharmacy", "drugstore"])) return 20;
  if (hasAny(["bank"])) return 15;
  if (hasAny(["atm"])) return 15;
  if (hasAny(["gas_station"])) return 10;
  if (hasAny(["parking"])) return 10;
  if (hasAny(["rest_stop"])) return 20;
  if (hasAny(["laundry"])) return 60;
  if (hasAny(["car_dealer", "car_repair"])) return 60;
  if (hasAny(["train_station", "bus_station", "ferry_terminal", "transit_station"])) return 20;
  if (hasAny(["bus_stop", "subway_station", "light_rail_station"])) return 5;

  // 104–106 (generic catch-alls / fallback)
  if (hasAny(["food", "meal"])) return 60;
  if (hasAny(["tourist_attraction", "point_of_interest"])) return 60;
  if (hasAny(["establishment"])) return 45;

  return 60;
}

/**
 * Convert one Google Place search result to CandidateActivity.
 * Pass apiKey to build real photo URL when photos are present.
 */
/** Format a Places API hour/minute pair as zero-padded HH:mm. Caps at 23:59. */
function formatHm(hour: number | undefined, minute: number | undefined): string {
  const h = Math.max(0, Math.min(23, Math.floor(hour ?? 0)));
  const m = Math.max(0, Math.min(59, Math.floor(minute ?? 0)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Convert Google Places `regularOpeningHours.periods` into a 7-entry weekly array
 * indexed by Date.prototype.getDay() (0 = Sunday). Each entry is either `null`
 * (closed all day) or one or more HH:mm windows for that weekday.
 *
 * Handling:
 * - Period with `open` but no `close` → 24h open that day.
 * - Period whose `close.day` is the next day (crosses midnight) → splits into
 *   `[open..23:59]` on the open day and `[00:00..close]` on the close day.
 * - Multiple periods on the same day are kept as separate windows (split shifts).
 *
 * Returns `undefined` if `periods` is empty/missing so callers can fall back.
 */
type PlacesPeriod = NonNullable<
  NonNullable<GooglePlaceSearchResult["regularOpeningHours"]>["periods"]
>[number];

function parseWeeklyHoursFromPeriods(
  periods: PlacesPeriod[] | undefined
): ({ start: string; end: string }[] | null)[] | undefined {
  if (!Array.isArray(periods) || periods.length === 0) return undefined;
  const week: ({ start: string; end: string }[] | null)[] = [
    null, null, null, null, null, null, null,
  ];
  for (const p of periods) {
    const openDay = p?.open?.day;
    if (typeof openDay !== "number" || openDay < 0 || openDay > 6) continue;
    const startStr = formatHm(p.open?.hour, p.open?.minute);
    if (!p.close) {
      const arr = week[openDay] ?? [];
      arr.push({ start: startStr, end: "23:59" });
      week[openDay] = arr;
      continue;
    }
    const closeDay = typeof p.close.day === "number" ? p.close.day : openDay;
    const closeStr = formatHm(p.close.hour, p.close.minute);
    if (closeDay === openDay) {
      const arr = week[openDay] ?? [];
      arr.push({ start: startStr, end: closeStr });
      week[openDay] = arr;
    } else {
      // Crosses midnight: split into two windows on consecutive days.
      const arrA = week[openDay] ?? [];
      arrA.push({ start: startStr, end: "23:59" });
      week[openDay] = arrA;
      const arrB = week[closeDay] ?? [];
      arrB.push({ start: "00:00", end: closeStr });
      week[closeDay] = arrB;
    }
  }
  return week;
}

/**
 * Pick a representative single daily window from `weeklyHours` for the legacy `openHours`
 * field. Strategy: take the *most permissive* day (earliest start, latest end across any
 * non-closed weekday). This keeps the existing vote-stage filter usable for places that
 * are open at all on any day, without falsely excluding a venue that's closed on Mondays.
 */
function pickRepresentativeOpenHours(
  weekly: ({ start: string; end: string }[] | null)[] | undefined
): { start: string; end: string } | undefined {
  if (!weekly) return undefined;
  let earliestStart: string | null = null;
  let latestEnd: string | null = null;
  for (const day of weekly) {
    if (!day) continue;
    for (const w of day) {
      if (earliestStart === null || w.start < earliestStart) earliestStart = w.start;
      if (latestEnd === null || w.end > latestEnd) latestEnd = w.end;
    }
  }
  if (!earliestStart || !latestEnd) return undefined;
  return { start: earliestStart, end: latestEnd };
}

function googlePlaceToCandidateActivity(
  place: GooglePlaceSearchResult,
  apiKey?: string | null
): CandidateActivity {
  const placeId = place.id ?? (place.name?.replace(/^places\//, "") ?? "");
  const name = place.displayName?.text ?? "Unnamed place";
  const types = place.types ?? [];
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  const primaryDisplay = place.primaryTypeDisplayName?.text;
  const firstPhoto = place.photos?.[0]?.name;

  let imageUrl: string | undefined;
  if (firstPhoto && apiKey) {
    imageUrl = buildPlacePhotoUrl(firstPhoto, apiKey);
  }

  const weeklyHours = parseWeeklyHoursFromPeriods(place.regularOpeningHours?.periods);
  const openHours = pickRepresentativeOpenHours(weeklyHours);

  return {
    placeId,
    name,
    location:
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !(lat === 0 && lng === 0)
        ? { lat, lng }
        : undefined,
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
    openHours,
    weeklyHours,
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
          "places.id,places.name,places.displayName,places.location,places.types,places.rating,places.priceLevel,places.photos,places.primaryTypeDisplayName,places.editorialSummary,places.regularOpeningHours",
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

  const activityHints = [
    ...(prefs.activityTypes ?? [])
      .filter((id) => id !== "other" && !id.startsWith("other:"))
      .map((id) => ACTIVITY_SEARCH_HINTS[id])
      .filter(Boolean),
    prefs.activityTypesOther?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

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
  /** Geocoded coordinates (Google Places `location`). Used by the transit pipeline to compute real leg times. */
  location?: { lat: number; lng: number };
}

const PLACE_DETAILS_STORAGE_KEY = "gtp_place_details_v1";
const PLACE_DETAILS_CACHE_MAX = 200;
const placeDetailsMemCache = new Map<string, PlaceDetailsResult>();

function normalizePlaceDetailsId(placeId: string): string {
  return placeId.replace(/^places\//, "").trim();
}

function loadPlaceDetailsCacheFromStorage() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PLACE_DETAILS_STORAGE_KEY) : null;
    if (!raw) return;
    const arr = JSON.parse(raw) as [string, PlaceDetailsResult][];
    if (!Array.isArray(arr)) return;
    placeDetailsMemCache.clear();
    for (const [k, v] of arr) {
      if (k && v?.placeId) placeDetailsMemCache.set(k, v);
    }
  } catch {
    /* ignore */
  }
}

function persistPlaceDetailsCacheSync() {
  try {
    if (typeof localStorage === "undefined") return;
    const entries = [...placeDetailsMemCache.entries()];
    while (entries.length > PLACE_DETAILS_CACHE_MAX) entries.shift();
    placeDetailsMemCache.clear();
    for (const [k, v] of entries) placeDetailsMemCache.set(k, v);
    localStorage.setItem(PLACE_DETAILS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode */
  }
}

let persistPlaceDetailsScheduled: ReturnType<typeof setTimeout> | null = null;
function schedulePersistPlaceDetailsCache() {
  if (persistPlaceDetailsScheduled != null) clearTimeout(persistPlaceDetailsScheduled);
  persistPlaceDetailsScheduled = setTimeout(() => {
    persistPlaceDetailsScheduled = null;
    persistPlaceDetailsCacheSync();
  }, 750);
}

loadPlaceDetailsCacheFromStorage();

/** Build detail payload from itinerary row data — no Places API. */
export function buildPlaceDetailsFromSavedItinerary(
  placeId: string,
  event: {
    title: string;
    image?: string | null;
    durationMinutes?: number;
    cost?: string;
    savedDescription?: string | null;
    savedCategoryLabel?: string | null;
    savedRating?: number;
  }
): PlaceDetailsResult {
  const id = normalizePlaceDetailsId(placeId);
  const desc = event.savedDescription?.trim() || null;
  const costLevel: PlaceDetailsResult["costLevel"] =
    event.cost?.includes("$$$") ? "high" : event.cost?.includes("$") ? "medium" : "medium";
  return {
    placeId: id,
    name: event.title,
    imageUrl: event.image ?? null,
    displayCategoryLabel: event.savedCategoryLabel?.trim() || null,
    description: desc,
    types: [],
    rating: event.savedRating,
    costLevel,
    estimatedDurationMinutes: Math.max(15, event.durationMinutes ?? 60),
  };
}

/**
 * Fetch place details by place ID (e.g. from autocomplete). Used to get real photo and labels for user-selected places.
 */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
  const apiKey = getApiKey();
  if (!apiKey || !placeId.trim()) return null;

  const id = normalizePlaceDetailsId(placeId);
  const cached = placeDetailsMemCache.get(id);
  if (cached) return cached;

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,location,photos,types,primaryTypeDisplayName,editorialSummary,priceLevel,rating,formattedAddress,nationalPhoneNumber,websiteUri,regularOpeningHours",
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

    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    const location =
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !(lat === 0 && lng === 0)
        ? { lat, lng }
        : undefined;

    const out: PlaceDetailsResult = {
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
      location,
    };
    if (placeDetailsMemCache.size >= PLACE_DETAILS_CACHE_MAX) {
      const first = placeDetailsMemCache.keys().next().value;
      if (first) placeDetailsMemCache.delete(first);
    }
    placeDetailsMemCache.set(id, out);
    schedulePersistPlaceDetailsCache();
    return out;
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

/**
 * Geographic context derived from a trip's destination string. Used to bias
 * and restrict downstream Places autocomplete (and similar) calls so a trip to
 * China doesn't surface suggestions in the United States.
 *
 * Fields are individually optional because Google's response can omit any of
 * them depending on how specific the destination text is (city vs. country
 * vs. POI); callers should treat each one as a soft hint.
 */
export interface DestinationGeoContext {
  /** Lowercase ISO 3166-1 alpha-2 country code (e.g. "cn", "us"). */
  regionCode?: string;
  /** Lat/lng rectangle covering the destination, suitable for `locationBias.rectangle`. */
  viewport?: { low: { lat: number; lng: number }; high: { lat: number; lng: number } };
  /** Centroid of the destination — fallback when no viewport is returned. */
  center?: { lat: number; lng: number };
}

const destinationGeoContextCache = new Map<string, DestinationGeoContext | null>();

/**
 * Resolve a free-text destination ("Suzhou, China") into a country code +
 * viewport + center point via one Places searchText call. Result is cached
 * per-session keyed on the destination string so we make at most one API
 * call per trip per session.
 *
 * Returns `null` if the API key is missing, the request fails, or no matching
 * place is found — callers should treat that as "no biasing data, fall back
 * to default Places behavior".
 */
export async function fetchDestinationGeoContext(
  destination: string,
  signal?: AbortSignal
): Promise<DestinationGeoContext | null> {
  const key = destination?.trim();
  if (!key) return null;
  if (destinationGeoContextCache.has(key)) {
    return destinationGeoContextCache.get(key) ?? null;
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    destinationGeoContextCache.set(key, null);
    return null;
  }

  const url = "https://places.googleapis.com/v1/places:searchText";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.location,places.viewport,places.addressComponents,places.types",
      },
      body: JSON.stringify({ textQuery: key, languageCode: "en" }),
      signal,
    });

    if (!res.ok) {
      destinationGeoContextCache.set(key, null);
      return null;
    }

    type GeoPlace = {
      id?: string;
      location?: { latitude?: number; longitude?: number };
      viewport?: {
        low?: { latitude?: number; longitude?: number };
        high?: { latitude?: number; longitude?: number };
      };
      addressComponents?: Array<{
        shortText?: string;
        longText?: string;
        types?: string[];
      }>;
      types?: string[];
    };
    const data = (await res.json()) as { places?: GeoPlace[] };
    const place = data.places?.[0];
    if (!place) {
      destinationGeoContextCache.set(key, null);
      return null;
    }

    const country = place.addressComponents?.find((c) => (c.types ?? []).includes("country"));
    const regionCode = country?.shortText?.trim().toLowerCase();
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    const center =
      typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : undefined;
    const lowLat = place.viewport?.low?.latitude;
    const lowLng = place.viewport?.low?.longitude;
    const highLat = place.viewport?.high?.latitude;
    const highLng = place.viewport?.high?.longitude;
    const viewport =
      typeof lowLat === "number" &&
      typeof lowLng === "number" &&
      typeof highLat === "number" &&
      typeof highLng === "number" &&
      Number.isFinite(lowLat) &&
      Number.isFinite(lowLng) &&
      Number.isFinite(highLat) &&
      Number.isFinite(highLng) &&
      // Reject degenerate viewports
      (highLat - lowLat) > 0 &&
      (highLng - lowLng) > 0
        ? { low: { lat: lowLat, lng: lowLng }, high: { lat: highLat, lng: highLng } }
        : undefined;

    const ctx: DestinationGeoContext = {
      regionCode: regionCode && regionCode.length === 2 ? regionCode : undefined,
      viewport,
      center,
    };
    destinationGeoContextCache.set(key, ctx);
    return ctx;
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    console.warn("[placeService] destination geo-context fetch error", err);
    destinationGeoContextCache.set(key, null);
    return null;
  }
}

