/**
 * Maps trip preference activity IDs (step 4) → Google Places primary types for boosting
 * vote/itinerary candidates. Works alongside diversity rules in activityEngine.
 */

export const PREFERENCE_TO_PLACE_TYPES: Record<string, string[]> = {
  beach: ["beach", "natural_feature"],
  hiking: [
    "hiking_area",
    "trail",
    "campground",
    "national_park",
    "state_park",
    "nature_reserve",
    "rv_park",
  ],
  culture: [
    "museum",
    "art_gallery",
    "cultural_center",
    "performing_arts_theater",
    "historical_landmark",
    "monument",
    "library",
    "ruins",
    "tourist_attraction",
  ],
  food: [
    "restaurant",
    "cafe",
    "bakery",
    "coffee_shop",
    "meal_takeaway",
    "meal_delivery",
    "food_court",
    "fast_food_restaurant",
    "market",
  ],
  nightlife: [
    "night_club",
    "bar",
    "brewery",
    "winery",
    "distillery",
    "casino",
    "comedy_club",
    "karaoke",
  ],
  shopping: [
    "shopping_mall",
    "department_store",
    "clothing_store",
    "shoe_store",
    "jewelry_store",
    "book_store",
    "electronics_store",
    "gift_shop",
    "market",
  ],
  spa: ["spa", "beauty_salon", "hair_care", "nail_salon", "gym", "fitness_center", "yoga_studio"],
  adventure: [
    "amusement_park",
    "water_park",
    "theme_park",
    "bowling_alley",
    "golf_course",
    "miniature_golf",
    "sports_complex",
    "escape_room",
    "stadium",
  ],
  photography: [
    "tourist_attraction",
    "historical_landmark",
    "monument",
    "observation_deck",
    "botanical_garden",
    "park",
    "beach",
    "natural_feature",
    "ruins",
  ],
  wildlife: ["zoo", "aquarium", "nature_reserve", "national_park", "botanical_garden", "natural_feature"],
  history: [
    "historical_landmark",
    "monument",
    "ruins",
    "museum",
    "cultural_center",
    "place_of_worship",
    "church",
    "mosque",
    "synagogue",
    "hindu_temple",
    "temple",
    "buddhist_temple",
  ],
  /** Alias for UI preference id used in PreferenceActivityScreen ("Water Sports"). */
  water: ["beach", "natural_feature", "marina", "boat_rental", "diving_center", "surfing_spot"],
  water_sports: ["beach", "natural_feature", "marina", "boat_rental", "diving_center", "surfing_spot"],
};

/** Added to finalScore in rankAndTrimCandidates (÷100). E.g. 10 → +0.10 on top of groupScore + selectedBoost. */
export const PREFERENCE_BOOST_SCORE = 10;

/**
 * Soft penalty when group has preference-derived boosted types, candidate does not overlap them,
 * and the place is not a meal anchor. (÷100). Never removes candidates.
 */
export const PREFERENCE_INCOMPATIBLE_PENALTY_SCORE = 3;

export function normalizeGooglePlaceType(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Meal / snack anchors — never receive incompatibility penalty (still boosted when types overlap food). */
export const MEAL_ANCHOR_PLACE_TYPES = new Set(
  (PREFERENCE_TO_PLACE_TYPES.food ?? []).map(normalizeGooglePlaceType)
);

export function placeTypesForActivityPreferenceId(prefId: string): string[] {
  const key = prefId.trim().toLowerCase();
  const mapped = PREFERENCE_TO_PLACE_TYPES[key];
  if (mapped?.length) return mapped.map(normalizeGooglePlaceType);
  // Legacy data / tests: activityTypes stored as raw Google type strings (e.g. "museum")
  if (/^[a-z][a-z0-9_]*$/i.test(key)) return [normalizeGooglePlaceType(key)];
  return [];
}

/** UNION of mapped Google place types for all given preference activity IDs. */
export function buildBoostedPlaceTypesUnion(preferenceActivityIds: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const id of preferenceActivityIds) {
    for (const pt of placeTypesForActivityPreferenceId(id)) {
      out.add(normalizeGooglePlaceType(pt));
    }
  }
  return out;
}

export function candidateOverlapsBoostedPlaceTypes(
  categories: string[] | undefined,
  boostedTypes: Set<string>
): boolean {
  if (!boostedTypes.size || !categories?.length) return false;
  const cats = categories.map(normalizeGooglePlaceType);
  return cats.some((c) => boostedTypes.has(c));
}

export function candidateHasMealAnchorType(categories: string[] | undefined): boolean {
  if (!categories?.length) return false;
  return categories.map(normalizeGooglePlaceType).some((c) => MEAL_ANCHOR_PLACE_TYPES.has(c));
}

/**
 * Whether a Places candidate is allowed when restricting recommendations to the group's
 * preference-type union. Empty groupTypes → no restriction. Meal types always pass so
 * food anchors stay available for itineraries.
 */
export function candidateMatchesGroupPreferencePlaceTypes(
  categories: string[] | undefined,
  groupTypes: Set<string>
): boolean {
  if (!groupTypes.size) return true;
  if (candidateOverlapsBoostedPlaceTypes(categories, groupTypes)) return true;
  if (candidateHasMealAnchorType(categories)) return true;
  return false;
}
