import { getApiProxyBase } from "../config/apiProxy";
import type { CandidateActivity, RankedCandidate } from "../types/activity";
import type { GroupPlanningProfile } from "../types/preference";
import type { MealFoodGapFillResponse, MealFoodGapRecommendation } from "../types/mealFoodGapFill";
import { isFoodActivity } from "../utils/activityClassifier";
import { COST_RANGE_BY_BUDGET } from "./planningService";
import { fetchPlacesForDestination } from "./placeService";

const MEAL_MINUTES = 60;

function normalizeFoodName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function budgetFloorDescription(profile: GroupPlanningProfile): string {
  const level = profile.groupBudgetLevel?.toLowerCase() ?? "moderate";
  const cr = COST_RANGE_BY_BUDGET[level] ?? COST_RANGE_BY_BUDGET.moderate;
  if (level === "budget") {
    return `Budget-conscious group: prefer affordable venues; rough cap ~${cr.maxPerDay ?? 50} USD/day activity spend excluding lodging.`;
  }
  if (level === "luxury") {
    return `Higher-spend group: upscale options acceptable; still recommend sensible base tier first.`;
  }
  return `Moderate budget: aim for roughly ${cr.minPerDay ?? 50}–${cr.maxPerDay ?? 150} USD/day style activity spend where relevant.`;
}

function isPriorityUserFoodPick(c: RankedCandidate): boolean {
  return (
    c.source === "user_selected" ||
    c.source === "selected_and_recommended" ||
    c.isSelectedByAnyMember === true ||
    c.selectedCount > 0
  );
}

function sortFoodCandidatesForMealPipeline(food: RankedCandidate[]): RankedCandidate[] {
  return [...food].sort((a, b) => {
    const pa = isPriorityUserFoodPick(a) ? 0 : 1;
    const pb = isPriorityUserFoodPick(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return 0;
  });
}

function pickFirstResolvedFoodPlace(
  places: CandidateActivity[],
  rec: MealFoodGapRecommendation,
  excludedTags: string[],
  usedPlaceIds: Set<string>,
  usedNames: Set<string>
): CandidateActivity | null {
  const recNorm = normalizeFoodName(rec.name);
  for (const p of places) {
    if (!p.placeId || usedPlaceIds.has(p.placeId)) continue;
    const nn = normalizeFoodName(p.name);
    if (usedNames.has(nn)) continue;
    if (excludedTags.length && (p.tags ?? []).some((t) => excludedTags.includes(t))) continue;
    if (!isFoodActivity(p)) continue;
    if (nn === recNorm || nn.includes(recNorm) || recNorm.includes(nn)) return p;
  }
  for (const p of places) {
    if (!p.placeId || usedPlaceIds.has(p.placeId)) continue;
    const nn = normalizeFoodName(p.name);
    if (usedNames.has(nn)) continue;
    if (excludedTags.length && (p.tags ?? []).some((t) => excludedTags.includes(t))) continue;
    if (!isFoodActivity(p)) continue;
    return p;
  }
  return null;
}

function toRankedFoodFromAiPlace(place: CandidateActivity, rec: MealFoodGapRecommendation): RankedCandidate {
  const why = rec.whyForThisGroup?.trim() || `Suggested ${rec.cuisineType || "dining"} option for the group.`;
  return {
    ...place,
    source: "ai_recommended_food",
    categories: place.categories?.length ? place.categories : ["restaurant", "food"],
    estimatedDuration: MEAL_MINUTES,
    aiRecommendationReason: why,
    description: [
      place.description?.trim(),
      why,
      rec.cuisineType ? `Cuisine: ${rec.cuisineType}` : "",
      `Meal: ${rec.mealType}`,
      `Price: ${rec.priceLevel}`,
    ]
      .filter(Boolean)
      .join(" — "),
    finalScore: -3,
    groupScore: -3,
    avgMemberScore: -3,
    minMemberScore: -3,
    selectedCount: 0,
    isSelectedByAnyMember: false,
  };
}

async function requestMealFoodGapFill(payload: {
  destination: string;
  remainingSlots: number;
  budgetFloor: string;
  excludedTags: string[];
  alreadySelectedFoodNames: string[];
}): Promise<MealFoodGapRecommendation[]> {
  const base = getApiProxyBase();
  try {
    const res = await fetch(`${base}/api/openai/meal-food-gap-fill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[mealFoodGapFill] HTTP", res.status);
      return [];
    }
    const data = (await res.json()) as MealFoodGapFillResponse & { error?: string };
    if (data && typeof data === "object" && "error" in data) {
      console.warn("[mealFoodGapFill] proxy error", data);
      return [];
    }
    const recs = Array.isArray(data?.recommendations) ? data.recommendations : [];
    return recs.filter(
      (r): r is MealFoodGapRecommendation =>
        r != null &&
        typeof r.name === "string" &&
        typeof r.searchQuery === "string" &&
        typeof r.mealType === "string" &&
        typeof r.cuisineType === "string" &&
        typeof r.priceLevel === "string" &&
        typeof r.whyForThisGroup === "string"
    );
  } catch (e) {
    console.warn("[mealFoodGapFill] request failed", e);
    return [];
  }
}

/**
 * Sort user/voted food first, then ask OpenAI for remaining meal slots and resolve each via Places.
 */
export async function expandFoodActivitiesWithAiMealGap(args: {
  destination: string;
  profile: GroupPlanningProfile;
  tripDays: number;
  foodActivities: RankedCandidate[];
}): Promise<RankedCandidate[]> {
  const sorted = sortFoodCandidatesForMealPipeline(args.foodActivities.filter(isFoodActivity));
  const totalMealSlots = args.tripDays * 2;
  const votedFoodCount = sorted.filter(isPriorityUserFoodPick).length;
  const remainingSlots = Math.max(0, totalMealSlots - votedFoodCount);

  if (remainingSlots <= 0) return sorted;

  const alreadySelectedFoodNames = sorted.map((f) => f.name.trim()).filter(Boolean);
  let recs: MealFoodGapRecommendation[];
  try {
    recs = await requestMealFoodGapFill({
      destination: args.destination,
      remainingSlots,
      budgetFloor: budgetFloorDescription(args.profile),
      excludedTags: args.profile.excludedTags ?? [],
      alreadySelectedFoodNames,
    });
  } catch {
    return sorted;
  }

  const usedPlaceIds = new Set(sorted.map((f) => f.placeId));
  const usedNames = new Set(sorted.map((f) => normalizeFoodName(f.name)));
  const appended: RankedCandidate[] = [];

  for (const rec of recs) {
    if (appended.length >= remainingSlots) break;
    const textQuery = rec.searchQuery.includes(args.destination.trim())
      ? rec.searchQuery.trim()
      : `${args.destination} ${rec.searchQuery}`.trim();
    let places: CandidateActivity[] = [];
    try {
      places = await fetchPlacesForDestination({
        destination: args.destination,
        textQuery,
        maxResults: 20,
      });
    } catch {
      continue;
    }
    const pick = pickFirstResolvedFoodPlace(places, rec, args.profile.excludedTags ?? [], usedPlaceIds, usedNames);
    if (!pick) continue;
    const row = toRankedFoodFromAiPlace(pick, rec);
    appended.push(row);
    usedPlaceIds.add(row.placeId);
    usedNames.add(normalizeFoodName(row.name));
  }

  return [...sorted, ...appended];
}
