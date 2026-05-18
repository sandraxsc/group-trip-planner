import {
  PREFERENCE_BOOST_SCORE,
  PREFERENCE_INCOMPATIBLE_PENALTY_SCORE,
  buildBoostedPlaceTypesUnion,
  candidateHasMealAnchorType,
  candidateMatchesGroupPreferencePlaceTypes,
  candidateOverlapsBoostedPlaceTypes,
  normalizeGooglePlaceType,
} from "../constants/activityMapping";
import { generateGroupPlanningProfile } from "./planningService";
import { getMemberPreferencesByTripId } from "./preferenceService";
import { getTripById } from "./tripService";
import { fetchPlacesForDestination, fetchPlaceDetails } from "./placeService";
import { enrichDurationWithFoursquare } from "./foursquareService";
import { computeVoteCandidateLimitForTrip, defaultMaxActivitiesPerDay } from "./dailyCapacityService";
import type { GroupPlanningProfile } from "../types/preference";
import type { MemberPreference } from "../types/preference";
import type { CandidateActivity, RankedCandidate, TimeOfDay } from "../types/activity";
import { timeToMinutes } from "../utils/timeUtils";

export { computeVoteCandidateLimitForTrip };

/** Default trip length in days when trip.tripDays is missing (for candidate limit). */
const DEFAULT_TRIP_DAYS = 3;

/** Primary categories for diversity re-ranking; fallback is "other". */
export type PrimaryCategory =
  | "food"
  | "culture"
  | "nature"
  | "shopping"
  | "nightlife"
  | "wellness"
  | "entertainment"
  | "other";

/** Maps category/type keywords to primary category. First match wins; order matters (more specific first). */
const PRIMARY_CATEGORY_RULES: { keywords: string[]; category: PrimaryCategory }[] = [
  // Food: aggressive so restaurant-like places don't fall into "other"
  {
    keywords: [
      "restaurant",
      "french_restaurant",
      "italian_restaurant",
      "japanese_restaurant",
      "lebanese_restaurant",
      "meal_takeaway",
      "meal_delivery",
      "cafe",
      "bakery",
      "bistro",
      "brasserie",
      "diner",
      "food",
      "bar",
      "pub",
      "eating",
      "dining",
      "eatery",
    ],
    category: "food",
  },
  { keywords: ["museum", "art_gallery", "tourist_attraction", "temple", "church", "place_of_worship", "hindu_temple", "historic_site"], category: "culture" },
  { keywords: ["park", "hiking_area", "beach", "campground", "garden", "natural_feature"], category: "nature" },
  { keywords: ["shopping_mall", "store", "market", "book_store"], category: "shopping" },
  { keywords: ["night_club", "karaoke", "casino"], category: "nightlife" },
  { keywords: ["spa", "sauna", "massage"], category: "wellness" },
  { keywords: ["movie_theater", "amusement_park", "bowling_alley", "aquarium", "zoo"], category: "entertainment" },
];

/** Name substrings that suggest food/restaurant when categories are weak or missing. */
const FOOD_NAME_HINTS = [
  "restaurant",
  "cafe",
  "coffee",
  "bakery",
  "bistro",
  "brasserie",
  "diner",
  "pub",
  "bar ",
  " bar",
  "kitchen",
  "eatery",
  "dining",
  "grill",
  "pizza",
  "sushi",
  "ramen",
  "tapas",
  "brunch",
  "breakfast",
  "lunch",
  "dinner",
];

/**
 * Derive primary category from candidate.categories (and optionally name) for diversity re-ranking.
 * Uses both category keywords and name fallback so restaurant-like places map to "food".
 * Returns "other" when no rule matches or categories are missing.
 */
export function getPrimaryCategory(candidate: { categories?: string[]; name?: string }): PrimaryCategory {
  const cats = (candidate.categories ?? []).map((c) => c.toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
  const name = (candidate.name ?? "").toLowerCase().trim().replace(/\s+/g, "_");
  const combined = [...cats, ...(name ? [name, name.replace(/_/g, " ")] : [])];
  for (const { keywords, category } of PRIMARY_CATEGORY_RULES) {
    if (keywords.some((kw) => combined.some((c) => c.length > 0 && (c.includes(kw) || kw.includes(c.replace(/_/g, " ")))))) {
      return category;
    }
  }
  if (name && FOOD_NAME_HINTS.some((hint) => name.includes(hint.replace(/\s/g, "_")) || (candidate.name ?? "").toLowerCase().includes(hint))) {
    return "food";
  }
  return "other";
}

/** Repeat penalty per occurrence of same primary category (stronger to reduce food dominance). */
const DIVERSITY_REPEAT_PENALTY = 0.12;

/** Extra penalty for food when already 2+ food in the first 6 slots (early-list diversity guard). */
const EARLY_FOOD_CAP_THRESHOLD = 2;
const EARLY_LIST_SIZE = 6;
const EARLY_FOOD_EXTRA_PENALTY = 0.30;

export interface DiversityRerankOptions {
  /** When true, log per-item diversity debug (dev-only). */
  debug?: boolean;
}

/**
 * Re-rank compatibility-ranked candidates with diversity: greedily select by
 * (finalScore - repeatPenalty - optionalEarlyFoodPenalty) so the same primary category
 * is not over-represented. Early list (first 6) gets a soft cap on food (max 2 before extra penalty).
 * Returns at most candidateLimit items.
 */
export function applyDiversityReranking(
  compatibilityRanked: RankedCandidate[],
  candidateLimit: number,
  options?: DiversityRerankOptions
): RankedCandidate[] {
  const limit = Math.max(1, candidateLimit);
  if (compatibilityRanked.length <= limit) return [...compatibilityRanked];

  const selected: RankedCandidate[] = [];
  const categoryCount: Record<PrimaryCategory, number> = {
    food: 0,
    culture: 0,
    nature: 0,
    shopping: 0,
    nightlife: 0,
    wellness: 0,
    entertainment: 0,
    other: 0,
  };
  const selectedIds = new Set<string>();
  const debugLog: { name: string; primaryCategory: string; repeatPenalty: number; earlyFoodPenalty: number; rerankScore: number }[] = [];

  while (selected.length < limit) {
    let best: RankedCandidate | null = null;
    let bestRerankScore = -Infinity;
    let bestRepeatPenalty = 0;
    let bestEarlyPenalty = 0;
    let bestPrimary: PrimaryCategory = "other";

    for (const c of compatibilityRanked) {
      if (selectedIds.has(c.placeId)) continue;
      const primary = getPrimaryCategory(c);
      const repeatPenalty = categoryCount[primary] * DIVERSITY_REPEAT_PENALTY;
      const inEarlyList = selected.length < EARLY_LIST_SIZE;
      const foodAtCap = inEarlyList && primary === "food" && categoryCount.food >= EARLY_FOOD_CAP_THRESHOLD;
      const earlyFoodPenalty = foodAtCap ? EARLY_FOOD_EXTRA_PENALTY : 0;
      const rerankScore = c.finalScore - repeatPenalty - earlyFoodPenalty;
      if (rerankScore > bestRerankScore) {
        bestRerankScore = rerankScore;
        best = c;
        bestRepeatPenalty = repeatPenalty;
        bestEarlyPenalty = earlyFoodPenalty;
        bestPrimary = primary;
      }
    }
    if (!best) break;
    selectedIds.add(best.placeId);
    selected.push(best);
    categoryCount[getPrimaryCategory(best)]++;
    if (options?.debug) {
      debugLog.push({
        name: best.name,
        primaryCategory: bestPrimary,
        repeatPenalty: bestRepeatPenalty,
        earlyFoodPenalty: bestEarlyPenalty,
        rerankScore: bestRerankScore,
      });
    }
  }

  if (options?.debug && debugLog.length > 0) {
    console.debug("[vote-ranking] diversity per item", debugLog);
  }

  return selected;
}

function isFoodPrimaryCandidate(c: RankedCandidate): boolean {
  return getPrimaryCategory(c) === "food";
}

/**
 * Diversity re-ranking can drop all food when multi-guest scores penalize restaurants.
 * Pull food back from the compatibility pool (up to `minFood`) so itineraries can fill meal slots.
 */
function ensureMinFoodInVoteCandidates(
  trimmed: RankedCandidate[],
  pool: RankedCandidate[],
  limit: number,
  minFood: number
): RankedCandidate[] {
  const cap = Math.max(1, limit);
  const target = Math.min(minFood, cap);
  const out = [...trimmed];
  const foodCount = () => out.filter(isFoodPrimaryCandidate).length;
  if (foodCount() >= target) return out;

  const poolFoodSorted = pool
    .filter((c) => isFoodPrimaryCandidate(c) && !out.some((x) => x.placeId === c.placeId))
    .sort((a, b) => b.finalScore - a.finalScore);

  for (const foodCand of poolFoodSorted) {
    if (foodCount() >= target) break;
    if (out.some((x) => x.placeId === foodCand.placeId)) continue;

    if (out.length < cap) {
      out.push(foodCand);
      continue;
    }

    let worstIdx = -1;
    let worstScore = Infinity;
    for (let i = 0; i < out.length; i++) {
      const item = out[i]!;
      if (isFoodPrimaryCandidate(item)) continue;
      if (item.finalScore < worstScore) {
        worstScore = item.finalScore;
        worstIdx = i;
      }
    }
    if (worstIdx === -1) break;
    out[worstIdx] = foodCand;
  }

  return out;
}

/**
 * Infer tags from a place name for deal-breaker matching (user-selected places).
 * Returns tags that might conflict with excludedTags.
 */
function inferTagsFromName(name: string): string[] {
  const n = name.toLowerCase();
  const tags: string[] = [];
  if (/\b(crowd|busy|tourist|popular)\b/.test(n)) tags.push("crowded");
  if (/\b(height|mountain|cliff|tower|rooftop|volcano)\b/.test(n)) tags.push("heights");
  if (/\b(beach|water|diving|swim|ocean|sea|river)\b/.test(n)) tags.push("water");
  if (/\b(animal|zoo|safari|wildlife|snake)\b/.test(n)) tags.push("animals");
  if (/\b(spicy|hot)\b/.test(n)) tags.push("spicy");
  if (/\b(long.?travel|road.?trip|bus|drive)\b/.test(n)) tags.push("long-travel");
  return tags;
}

/**
 * Check if an activity should be excluded because its tags intersect group deal breakers.
 */
export function activityTagsIntersectExcluded(
  activity: CandidateActivity,
  excludedTags: string[]
): boolean {
  if (!excludedTags.length) return false;
  const tags = activity.tags ?? [];
  const nameTags =
    activity.source === "user_selected" || activity.source === "selected_and_recommended"
      ? inferTagsFromName(activity.name)
      : [];
  const allTags = [...new Set([...tags.map((t) => t.toLowerCase()), ...nameTags])];
  const excluded = new Set(excludedTags.map((t) => t.toLowerCase()));
  return allTags.some((t) => excluded.has(t));
}

/** Time windows for suitableTime when openHours is missing (HH:mm). */
const TIME_OF_DAY_WINDOWS: Record<TimeOfDay, { start: string; end: string }> = {
  morning: { start: "09:00", end: "12:00" },
  afternoon: { start: "12:00", end: "18:00" },
  evening: { start: "18:00", end: "21:00" },
};

/**
 * Get candidate time window: use openHours if present, else derive from suitableTime (union of windows).
 */
function getCandidateTimeWindow(candidate: CandidateActivity): { start: string; end: string } | null {
  if (candidate.openHours?.start != null && candidate.openHours?.end != null) {
    return { start: candidate.openHours.start, end: candidate.openHours.end };
  }
  const times = candidate.suitableTime ?? [];
  if (times.length === 0) return null;
  let startMin = 24 * 60;
  let endMin = 0;
  for (const t of times) {
    const w = TIME_OF_DAY_WINDOWS[t];
    if (w) {
      startMin = Math.min(startMin, timeToMinutes(w.start));
      endMin = Math.max(endMin, timeToMinutes(w.end));
    }
  }
  if (startMin >= endMin) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${Math.floor(startMin / 60)}:${pad(startMin % 60)}`,
    end: `${Math.floor(endMin / 60)}:${pad(endMin % 60)}`,
  };
}

/**
 * True if candidate's time window overlaps commonActiveHours. If candidate has no window, treat as overlap (do not exclude).
 * Exported for unit tests.
 */
export function hasOpenHoursOverlap(
  candidate: CandidateActivity,
  commonActiveHours: { start: string; end: string }
): boolean {
  const window = getCandidateTimeWindow(candidate);
  if (!window) return true;
  const commonStart = timeToMinutes(commonActiveHours.start);
  const commonEnd = timeToMinutes(commonActiveHours.end);
  const candStart = timeToMinutes(window.start);
  const candEnd = timeToMinutes(window.end);
  return commonStart < candEnd && commonEnd > candStart;
}

/**
 * Overlap length in minutes; 0 if no overlap. Used for timeMatch ratio.
 */
function overlapMinutes(
  a: { start: string; end: string },
  b: { start: string; end: string }
): number {
  const aS = timeToMinutes(a.start);
  const aE = timeToMinutes(a.end);
  const bS = timeToMinutes(b.start);
  const bE = timeToMinutes(b.end);
  const start = Math.max(aS, bS);
  const end = Math.min(aE, bE);
  return Math.max(0, end - start);
}

/**
 * Build CandidateActivity list from group's user-selected place names/ids.
 * When placeId looks like a Google place ID (ChIJ...), fetch details to get real image, category, description, price.
 */
async function buildUserSelectedActivities(
  profile: GroupPlanningProfile
): Promise<CandidateActivity[]> {
  const places = profile.candidatePlaces ?? [];
  const results: CandidateActivity[] = [];

  for (const nameOrId of places) {
    if (typeof nameOrId !== "string" || !nameOrId.trim()) continue;

    const normalizedId = nameOrId.replace(/^places\//, "");
    const isGooglePlaceId =
      nameOrId.startsWith("places/") ||
      normalizedId.startsWith("ChIJ") ||
      /^ChIJ[\w-]+$/.test(normalizedId);
    const placeId = isGooglePlaceId
      ? normalizedId
      : `user-${nameOrId.replace(/\s+/g, "-")}`;

    const base: CandidateActivity = {
      placeId,
      name: nameOrId,
      location: undefined,
      categories: [],
      estimatedDuration: 120,
      costLevel: "medium",
      intensity: "medium",
      suitableTime: ["morning", "afternoon", "evening"],
      tags: inferTagsFromName(nameOrId),
      source: "user_selected",
    };

    if (isGooglePlaceId) {
      try {
        const details = await fetchPlaceDetails(normalizedId);
        if (details) {
          base.name = details.name || nameOrId;
          if (details.imageUrl) base.imageUrl = details.imageUrl;
          if (details.displayCategoryLabel) base.displayCategoryLabel = details.displayCategoryLabel;
          if (details.description) base.description = details.description;
          if (details.types?.length) base.categories = details.types;
          base.estimatedDuration = details.estimatedDurationMinutes ?? 120;
          base.costLevel = details.costLevel;
          if (details.priceLevel !== undefined) base.priceLevel = details.priceLevel;
        }
      } catch {
        // keep base when fetch fails
      }
    }

    results.push(base);
  }

  return results;
}

/**
 * Score an activity against the group profile. Higher = better fit.
 * Factors: category match, rating, budget fit, time fit.
 * Penalties: deal-breaker tag, poor rating.
 */
export function scoreActivity(
  activity: CandidateActivity,
  profile: GroupPlanningProfile
): number {
  let score = 50; // base

  // Deal breaker: already filtered out before scoring, but if somehow present, heavy penalty
  if (activityTagsIntersectExcluded(activity, profile.excludedTags)) {
    return 0;
  }

  // Category match: preference IDs expanded to Google types (union), plus literal id/name overlap
  const profilePrefIds = (profile.commonActivityTypes ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const boostedUnion = buildBoostedPlaceTypesUnion(profilePrefIds);
  const activityCats = new Set((activity.categories ?? []).map(normalizeGooglePlaceType));
  const activityName = activity.name.toLowerCase();
  const categoryMatch =
    [...boostedUnion].some((t) => activityCats.has(t)) ||
    profilePrefIds.some(
      (id) => activityCats.has(normalizeGooglePlaceType(id)) || activityName.includes(id)
    );
  if (categoryMatch) score += 25;

  // Rating: boost for high rating
  const rating = activity.rating ?? 0;
  if (rating >= 4.5) score += 20;
  else if (rating >= 4) score += 10;
  else if (rating >= 3.5) score += 5;
  else if (rating > 0 && rating < 3) score -= 15;

  // Budget fit: compare costLevel to groupBudgetLevel
  const budget = profile.groupBudgetLevel?.toLowerCase() ?? "moderate";
  const cost = activity.costLevel;
  if (budget === "budget" && cost === "low") score += 15;
  else if (budget === "budget" && cost === "high") score -= 20;
  else if (budget === "luxury" && cost === "high") score += 10;
  else if (budget === "luxury" && cost === "low") score += 5;
  else if (budget === "moderate" && cost === "medium") score += 10;

  // User-selected: prefer to keep in list
  if (activity.source === "user_selected") score += 30;

  return Math.max(0, score);
}

/** Ordinal rank for budget (member and cost level): 1 = low/budget, 2 = medium/moderate, 3 = high/luxury. */
const BUDGET_ORDINAL: Record<string, number> = {
  budget: 1, low: 1, moderate: 2, medium: 2, luxury: 3, high: 3,
};
/** Ordinal for energy/intensity: 1 = low, 2 = medium, 3 = high. */
const ENERGY_ORDINAL: Record<string, number> = {
  low: 1, medium: 2, high: 3,
};

function typeMatch(member: MemberPreference, candidate: CandidateActivity): number {
  const rawIds = (member.activityTypes ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (rawIds.length === 0) return 0.5;

  const boostedUnion = buildBoostedPlaceTypesUnion(rawIds);
  const catSet = new Set((candidate.categories ?? []).map(normalizeGooglePlaceType));
  const name = candidate.name.toLowerCase();

  const googleOverlap = [...boostedUnion].some((t) => catSet.has(t));
  const literalOverlap = rawIds.some(
    (id) => catSet.has(normalizeGooglePlaceType(id)) || name.includes(id)
  );

  const otherNote = member.activityTypesOther?.trim().toLowerCase();
  const otherTerms = otherNote
    ? otherNote.split(/[,;]+/).map((s) => s.trim()).filter((s) => s.length >= 2)
    : [];
  const otherOverlap =
    otherTerms.length > 0 && otherTerms.some((term) => name.includes(term));

  return googleOverlap || literalOverlap || otherOverlap ? 1 : 0;
}

function budgetMatch(member: MemberPreference, candidate: CandidateActivity): number {
  const mRank = BUDGET_ORDINAL[(member.budgetLevel ?? "moderate").toLowerCase()] ?? 2;
  const cRank = BUDGET_ORDINAL[(candidate.costLevel ?? "medium").toLowerCase()] ?? 2;
  const d = Math.abs(mRank - cRank);
  if (d === 0) return 1;
  if (d === 1) return 0.5;
  return 0;
}

function energyMatch(member: MemberPreference, candidate: CandidateActivity): number {
  const mRank = ENERGY_ORDINAL[(member.energyLevel ?? "medium").toLowerCase()] ?? 2;
  const cRank = ENERGY_ORDINAL[(candidate.intensity ?? "medium").toLowerCase()] ?? 2;
  const d = Math.abs(mRank - cRank);
  if (d === 0) return 1;
  if (d === 1) return 0.5;
  return 0;
}

function timeMatch(
  member: MemberPreference,
  candidate: CandidateActivity,
  commonActiveHours: { start: string; end: string }
): number {
  const memberWindow = member.activeHours;
  if (!memberWindow) return 0.5;
  const candWindow = getCandidateTimeWindow(candidate);
  if (!candWindow) return 0.5;
  const overlap = overlapMinutes(memberWindow, candWindow);
  const memberSpan = timeToMinutes(memberWindow.end) - timeToMinutes(memberWindow.start);
  const candSpan = timeToMinutes(candWindow.end) - timeToMinutes(candWindow.start);
  if (memberSpan <= 0 || candSpan <= 0) return 0;
  const ratio = overlap / Math.min(memberSpan, candSpan);
  return Math.min(1, Math.max(0, ratio));
}

/** True if this candidate is one of the member's chosen places (preference flow). */
export function candidateMatchesMemberSelectedPlaces(
  selectedPlaces: string[] | undefined,
  candidate: Pick<CandidateActivity, "placeId" | "name">
): boolean {
  const selected = selectedPlaces ?? [];
  if (!selected.length) return false;
  return selected.some(
    (p) =>
      Boolean(p) &&
      (p === candidate.placeId ||
        p === candidate.name ||
        candidate.name.toLowerCase().includes(p.toLowerCase()))
  );
}

function preferenceBoost(member: MemberPreference, candidate: CandidateActivity): number {
  return candidateMatchesMemberSelectedPlaces(member.selectedPlaces, candidate) ? 1 : 0;
}

/**
 * Member-level score: 0.30*typeMatch + 0.25*budgetMatch + 0.20*energyMatch + 0.15*timeMatch + 0.10*preferenceBoost.
 * All sub-scores in 0..1.
 */
function memberScore(
  member: MemberPreference,
  candidate: CandidateActivity,
  commonActiveHours: { start: string; end: string }
): number {
  return (
    0.3 * typeMatch(member, candidate) +
    0.25 * budgetMatch(member, candidate) +
    0.2 * energyMatch(member, candidate) +
    0.15 * timeMatch(member, candidate, commonActiveHours) +
    0.1 * preferenceBoost(member, candidate)
  );
}

/** Debug breakdown for manual verification of ranking pipeline (when options.debug is true). */
export interface RankingDebugBreakdown {
  inputCount: number;
  afterExcludedTagsCount: number;
  afterOpenHoursCount: number;
  candidateLimit: number;
  memberCount: number;
  rankedCount: number;
}

/**
 * Pure ranking pipeline: filter by excludedTags and openHours overlap, score per member,
 * aggregate (0.7*avg + 0.3*min), add selectedBoost when selectedCount > 0 (cap 0.25 at 4+), preference Google-type boost
 * (see PREFERENCE_BOOST_SCORE), optional soft incompatibility penalty vs meal anchors,
 * sort by finalScore/selectedCount/rating, trim to candidateLimit.
 * Exported for unit tests and optional debug breakdown.
 */
export function rankAndTrimCandidates(
  candidates: CandidateActivity[],
  memberPrefs: MemberPreference[],
  commonActiveHours: { start: string; end: string },
  excludedTags: string[],
  candidateLimit: number,
  options?: { debug?: boolean }
): RankedCandidate[] | { ranked: RankedCandidate[]; debug: RankingDebugBreakdown } {
  const inputCount = candidates.length;
  const afterExcluded = candidates.filter(
    (a) => !activityTagsIntersectExcluded(a, excludedTags)
  );
  const afterExcludedTagsCount = afterExcluded.length;
  const afterTime = afterExcluded.filter((a) => hasOpenHoursOverlap(a, commonActiveHours));
  const afterOpenHoursCount = afterTime.length;

  const groupBoostedPlaceTypes = buildBoostedPlaceTypesUnion(
    memberPrefs.flatMap((m) =>
      (m.activityTypes ?? [])
        .filter((t) => t !== "other" && !t.startsWith("other:"))
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const ranked: RankedCandidate[] = afterTime.map((activity) => {
    const memberScoresList =
      memberPrefs.length > 0
        ? memberPrefs.map((m) => memberScore(m, activity, commonActiveHours))
        : [0.5];
    const avgMemberScore =
      memberScoresList.reduce((s, x) => s + x, 0) / memberScoresList.length;
    const minMemberScore = Math.min(...memberScoresList);
    const groupScore = 0.7 * avgMemberScore + 0.3 * minMemberScore;

    const selectedCount = memberPrefs.filter((m) => preferenceBoost(m, activity) === 1).length;
    const selectedBoost =
      selectedCount > 0 ? Math.min(0.25, 0.05 + 0.05 * selectedCount) : 0;

    const overlapsPrefs = candidateOverlapsBoostedPlaceTypes(activity.categories, groupBoostedPlaceTypes);
    const preferencePlaceBoost =
      groupBoostedPlaceTypes.size > 0 && overlapsPrefs ? PREFERENCE_BOOST_SCORE / 100 : 0;
    const preferencePlacePenalty =
      groupBoostedPlaceTypes.size > 0 &&
      !overlapsPrefs &&
      !candidateHasMealAnchorType(activity.categories)
        ? -(PREFERENCE_INCOMPATIBLE_PENALTY_SCORE / 100)
        : 0;

    const finalScore = Math.max(
      0,
      groupScore + selectedBoost + preferencePlaceBoost + preferencePlacePenalty
    );

    return {
      ...activity,
      finalScore,
      groupScore,
      avgMemberScore,
      minMemberScore,
      selectedCount,
      isSelectedByAnyMember: selectedCount > 0,
    };
  });

  ranked.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.selectedCount !== a.selectedCount) return b.selectedCount - a.selectedCount;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  const trimmed = ranked.slice(0, Math.max(1, candidateLimit));
  const rankedCount = trimmed.length;

  if (options?.debug) {
    return {
      ranked: trimmed,
      debug: {
        inputCount,
        afterExcludedTagsCount,
        afterOpenHoursCount,
        candidateLimit: Math.max(1, candidateLimit),
        memberCount: memberPrefs.length,
        rankedCount,
      },
    };
  }
  return trimmed;
}

/**
 * Deduplicate by placeId, then by normalized name. When the same place appears from both
 * user-selected and system-recommended, keep one and set source = 'selected_and_recommended'.
 * Exported for unit tests.
 */
export function deduplicateActivities(activities: CandidateActivity[]): CandidateActivity[] {
  const byPlaceId = new Map<string, { activity: CandidateActivity; seenUser: boolean; seenSystem: boolean }>();
  for (const a of activities) {
    const isUser = a.source === "user_selected" || a.source === "selected_and_recommended";
    const entry = byPlaceId.get(a.placeId);
    if (!entry) {
      byPlaceId.set(a.placeId, {
        activity: { ...a },
        seenUser: isUser,
        seenSystem: !isUser,
      });
    } else {
      if (isUser) entry.seenUser = true;
      else entry.seenSystem = true;
      if (isUser) entry.activity = { ...a };
    }
  }
  let list = [...byPlaceId.values()].map((e) => {
    const activity = { ...e.activity };
    if (e.seenUser && e.seenSystem) activity.source = "selected_and_recommended";
    return activity;
  });
  const byName = new Map<string, CandidateActivity>();
  for (const a of list) {
    const nameKey = a.name.trim().toLowerCase();
    const existing = byName.get(nameKey);
    const isUser = a.source === "user_selected" || a.source === "selected_and_recommended";
    const keepThis = !existing || (isUser && existing.source === "system_recommended");
    if (keepThis) byName.set(nameKey, { ...a });
    else if (isUser && existing) byName.set(nameKey, { ...existing, source: "selected_and_recommended" });
  }
  return [...byName.values()];
}

/**
 * Enrich durations for a subset of scored activities using Foursquare.
 * - Only top-ranked activities and all user-selected ones are enriched
 * - Falls back to existing estimatedDuration when Foursquare has no data
 */
async function enrichDurationsWithFoursquare(
  scored: { activity: CandidateActivity; score: number }[],
  destination: string
): Promise<{ activity: CandidateActivity; score: number }[]> {
  if (!scored.length) return scored;

  // Limit Foursquare calls to top K for quota and always include user-selected.
  const TOP_FOR_FSQ = 10;
  const indicesToEnrich = new Set<number>();

  for (let i = 0; i < scored.length && i < TOP_FOR_FSQ; i++) {
    indicesToEnrich.add(i);
  }
  scored.forEach((item, idx) => {
    if (item.activity.source === "user_selected") indicesToEnrich.add(idx);
  });

  const tasks = Array.from(indicesToEnrich).map(async (idx) => {
    const entry = scored[idx];
    if (!entry) return;
    const { activity } = entry;
    const result = await enrichDurationWithFoursquare({
      name: activity.name,
      destination,
      currentMinutes: activity.estimatedDuration,
    });
    activity.estimatedDuration = result.minutes;
    activity.durationSource = result.source;
  });

  await Promise.all(tasks);
  return scored;
}

/**
 * Build ranked vote candidates: merge user-selected and API-recommended, apply hard filters,
 * score per member then aggregate (groupScore + selectedBoost), sort, trim to candidateLimit.
 * candidateLimit = (tripDays × defaultMaxActivitiesPerDay) + 5 until GPT daily-capacity runs at itinerary time.
 */
export async function getRankedVoteCandidates(tripId: string): Promise<RankedCandidate[]> {
  const profile = generateGroupPlanningProfile(tripId);
  const trip = getTripById(tripId);
  if (!profile || !trip) return [];

  const memberPrefs = getMemberPreferencesByTripId(tripId);
  const commonHours = profile.commonActiveHours ?? { start: "09:00", end: "21:00" };

  const userSelected = await buildUserSelectedActivities(profile);
  const filteredUser = userSelected.filter(
    (a) => !activityTagsIntersectExcluded(a, profile.excludedTags ?? [])
  );

  const candidateLimit = computeVoteCandidateLimitForTrip(tripId);
  const tripDays = trip.tripDays ?? DEFAULT_TRIP_DAYS;
  const maxDaily = defaultMaxActivitiesPerDay();
  const debugRanking = (typeof (import.meta as { env?: { DEV?: boolean } }).env !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) === true;

  // IMPORTANT: vote candidates are now derived ONLY from group-selected places.
  // Any additional candidates should come from AI gap-fill (voteGapFillService) + Places resolution,
  // not from the system Google Places "query variants" pool.
  let trimmed: RankedCandidate[] = [];
  let lastResult: RankedCandidate[] | { ranked: RankedCandidate[]; debug: RankingDebugBreakdown } = [];
  let lastCompatibilityPool: RankedCandidate[] = [];

  function runRankingPipeline(systemPool: CandidateActivity[]): {
    trimmed: RankedCandidate[];
    compatibilityPool: RankedCandidate[];
    rankRaw: RankedCandidate[] | { ranked: RankedCandidate[]; debug: RankingDebugBreakdown };
  } {
    const combined = [...filteredUser, ...systemPool];
    const deduped = deduplicateActivities(combined);
    const afterDealBreakers = deduped.filter(
      (a) => !activityTagsIntersectExcluded(a, profile.excludedTags ?? [])
    );
    const poolLimit = Math.min(afterDealBreakers.length, Math.max(candidateLimit * 2, 30));
    const rankRaw = rankAndTrimCandidates(
      afterDealBreakers,
      memberPrefs,
      commonHours,
      profile.excludedTags ?? [],
      poolLimit,
      debugRanking ? { debug: true } : undefined
    );
    const compatibilityPool = Array.isArray(rankRaw) ? rankRaw : rankRaw.ranked;
    const trimmed = applyDiversityReranking(
      compatibilityPool,
      candidateLimit,
      debugRanking ? { debug: true } : undefined
    );
    return { trimmed, compatibilityPool, rankRaw };
  }

  const pipeline = runRankingPipeline([]);
  trimmed = pipeline.trimmed;
  lastCompatibilityPool = pipeline.compatibilityPool;
  lastResult = pipeline.rankRaw;

  trimmed = ensureMinFoodInVoteCandidates(trimmed, lastCompatibilityPool, candidateLimit, 2);

  if (debugRanking) {
    if (!Array.isArray(lastResult)) {
      const debug = (lastResult as { debug: RankingDebugBreakdown }).debug;
      console.debug("[vote-ranking] pipeline", debug);
      const whyLess =
        debug.rankedCount < debug.candidateLimit
          ? `Showing ${debug.rankedCount} (not ${debug.candidateLimit}): only ${debug.afterOpenHoursCount} candidates passed filters (excludedTags + openHours). candidateLimit is the max allowed.`
          : null;
      if (whyLess) console.debug("[vote-ranking] why fewer than candidateLimit?", whyLess);
    }
    console.debug("[vote-ranking] diversity", {
      diversityApplied: true,
      preDiversityCount: lastCompatibilityPool.length,
      postDiversityCount: trimmed.length,
    });
    console.debug("[vote-ranking] factors (why this many activities)", {
      tripDays,
      maxDailyActivities: maxDaily,
      candidateLimit,
      groupEnergyLevel: profile.groupEnergyLevel ?? "medium",
      formula: `candidateLimit = (tripDays (${tripDays}) × defaultMaxActivitiesPerDay (${maxDaily})) + 5 = ${candidateLimit}`,
      selectedBoostFormula:
        "selectedCount > 0 ? min(0.25, 0.05 + 0.05 * selectedCount) : 0",
    });
    console.debug(
      "[vote-ranking] score per activity (ordered by finalScore desc)",
      trimmed.map((r) => ({
        name: r.name,
        placeId: r.placeId,
        finalScore: Math.round(r.finalScore * 100) / 100,
        groupScore: Math.round(r.groupScore * 100) / 100,
        avgMemberScore: Math.round(r.avgMemberScore * 100) / 100,
        minMemberScore: Math.round(r.minMemberScore * 100) / 100,
        selectedCount: r.selectedCount,
        aboveGroupScore: Math.round((r.finalScore - r.groupScore) * 100) / 100,
      }))
    );
    if (trimmed.length > 0) {
      console.table(
        trimmed.map((r, i) => ({
          "#": i + 1,
          name: r.name,
          finalScore: Math.round(r.finalScore * 100) / 100,
          groupScore: Math.round(r.groupScore * 100) / 100,
          selectedCount: r.selectedCount,
        }))
      );
    }
  }

  await enrichDurationsForRanked(trimmed, profile.destination);

  return trimmed;
}

async function enrichDurationsForRanked(
  list: RankedCandidate[],
  destination: string
): Promise<void> {
  const TOP_FOR_FSQ = 10;
  const indices = new Set<number>();
  for (let i = 0; i < list.length && i < TOP_FOR_FSQ; i++) indices.add(i);
  list.forEach((item, idx) => {
    if (item.source === "user_selected" || item.source === "selected_and_recommended") indices.add(idx);
  });
  await Promise.all(
    Array.from(indices).map(async (idx) => {
      const a = list[idx];
      if (!a) return;
      const result = await enrichDurationWithFoursquare({
        name: a.name,
        destination,
        currentMinutes: a.estimatedDuration,
      });
      a.estimatedDuration = result.minutes;
      a.durationSource = result.source;
    })
  );
}

/**
 * Generate candidate activities for a trip: delegates to getRankedVoteCandidates so the
 * Vote page receives a merged, ranked list (user-selected + API-recommended) trimmed to
 * candidateLimit = (tripDays * maxDailyActivities) + 5.
 */
export async function generateCandidateActivities(tripId: string): Promise<RankedCandidate[]> {
  return getRankedVoteCandidates(tripId);
}
