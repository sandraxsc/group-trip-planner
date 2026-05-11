import { getTripById } from "./tripService";
import { getRankedVoteCandidates } from "./activityEngine";
import { getPrimaryCategory } from "./activityEngine";
import { generateGroupPlanningProfile } from "./planningService";
import { getAggregatedVotesByTripId } from "./voteService";
import { ACTIVITIES_PER_DAY_BY_ENERGY } from "./planningService";
import { fetchPlacesForDestination } from "./placeService";
import type { CandidateActivity, RankedCandidate } from "../types/activity";
import type {
  Itinerary,
  ItineraryDay,
  ItineraryBlock,
  MealBlock,
  ScheduledActivity,
  TimeBlockLabel,
} from "../types/itinerary";

const REMOVE_BOTTOM_N = 5;
const MEAL_SLOT_MINUTES = 60;
const LUNCH_START = "12:00";
const DINNER_START = "19:00";
/** Max distance in km to consider two activities "nearby" for clustering (Haversine approx). */
const NEARBY_KM = 2.5;

/** Dev always; production only if `VITE_DEBUG_ITINERARY=true` (e.g. on Vercel) — logs food/meal pipeline. */
function itineraryDebugEnabled(): boolean {
  const v = import.meta.env?.VITE_DEBUG_ITINERARY;
  return import.meta.env.DEV || v === "true" || v === "1";
}

/** Convert "HH:mm" to minutes since midnight. */
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Re-rank activities by vote results. Each member's vote contributes (up = +1, down = -1).
 * Weighted: we use simple sum; extensible for future weight per member.
 */
export function rankActivitiesFromVotes(
  candidates: RankedCandidate[],
  tripId: string
): RankedCandidate[] {
  const agg = getAggregatedVotesByTripId(tripId);
  const scored = candidates.map((c) => {
    const v = agg[c.placeId] ?? { up: 0, down: 0 };
    const voteScore = v.up - v.down;
    return { candidate: c, voteScore };
  });
  scored.sort((a, b) => b.voteScore - a.voteScore);
  if (itineraryDebugEnabled()) {
    // Log ranking based purely on votes before itinerary generation trims / clusters.
    // Higher voteScore means more up-votes relative to down-votes.
    // This is the first pass of ranking after voting is submitted.
    // eslint-disable-next-line no-console
    console.log(
      "[itinerary] vote-based ranking",
      scored.map((s, idx) => ({
        index: idx + 1,
        placeId: s.candidate.placeId,
        name: s.candidate.name,
        voteScore: s.voteScore,
      }))
    );
  }
  return scored.map((s) => s.candidate);
}

/**
 * Remove the lowest N ranked activities from the list.
 */
export function removeLowestRankedActivities<T>(list: T[], n: number): T[] {
  if (n <= 0) return list;
  return list.slice(0, Math.max(0, list.length - n));
}

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Suggest restaurants (CandidateActivity list) for a destination. Used when we need
 * to auto-fill empty lunch/dinner slots. We still do local filtering / ranking by
 * budget, rating and distance inside itineraryService.
 */
async function fetchRestaurantCandidatesForDestination(
  destination: string,
  maxResults: number
): Promise<CandidateActivity[]> {
  // Reuse our text search adapter with a restaurant-focused query.
  return fetchPlacesForDestination({
    destination,
    maxResults,
    textQueryOverride: "restaurants",
  });
}

/**
 * Cluster activities by location. Returns groups of placeIds that are nearby.
 * Activities without location are in a separate "noLocation" group.
 */
export function clusterActivitiesByLocation(
  activities: RankedCandidate[]
): { clusters: string[][]; noLocation: string[] } {
  const withLoc = activities.filter((a) => a.location?.lat != null && a.location?.lng != null);
  const noLocation = activities.filter((a) => !a.location?.lat || !a.location?.lng).map((a) => a.placeId);
  const used = new Set<string>();
  const clusters: string[][] = [];

  for (const a of withLoc) {
    if (used.has(a.placeId)) continue;
    const cluster: string[] = [a.placeId];
    used.add(a.placeId);
    const lat = a.location!.lat;
    const lng = a.location!.lng;
    for (const b of withLoc) {
      if (used.has(b.placeId)) continue;
      if (haversineKm(lat, lng, b.location!.lat, b.location!.lng) <= NEARBY_KM) {
        cluster.push(b.placeId);
        used.add(b.placeId);
      }
    }
    clusters.push(cluster);
  }
  return { clusters, noLocation };
}

/**
 * Max non-meal activities per day by group energy level (configurable).
 */
export function getMaxActivitiesPerDayByEnergyLevel(
  energyLevel: string
): number {
  const key = (energyLevel ?? "medium").toLowerCase();
  const range = ACTIVITIES_PER_DAY_BY_ENERGY[key] ?? { min: 2, max: 3 };
  return range.max;
}

/**
 * Reserve lunch and dinner slots for a day. Each slot is 60 minutes.
 */
export function reserveMealSlotsForDay(
  dayStart: string,
  dayEnd: string
): { lunch: MealBlock; dinner: MealBlock } {
  const lunchStart = timeToMinutes(LUNCH_START);
  const dinnerStart = timeToMinutes(DINNER_START);
  return {
    lunch: {
      label: "lunch",
      startTime: LUNCH_START,
      endTime: minutesToTime(lunchStart + MEAL_SLOT_MINUTES),
    },
    dinner: {
      label: "dinner",
      startTime: DINNER_START,
      endTime: minutesToTime(dinnerStart + MEAL_SLOT_MINUTES),
    },
  };
}

/**
 * Check if an activity of given duration fits in a time block given existing scheduled activities.
 */
export function canActivityFitInBlock(
  blockStart: string,
  blockEnd: string,
  durationMinutes: number,
  existingActivities: ScheduledActivity[]
): boolean {
  const blockStartMin = timeToMinutes(blockStart);
  const blockEndMin = timeToMinutes(blockEnd);
  let nextFree = blockStartMin;
  const sorted = [...existingActivities].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  for (const a of sorted) {
    const start = timeToMinutes(a.startTime);
    const end = timeToMinutes(a.endTime);
    if (start > nextFree && start - nextFree >= durationMinutes) {
      return true;
    }
    nextFree = Math.max(nextFree, end);
  }
  return blockEndMin - nextFree >= durationMinutes;
}

/**
 * Find the next available start time in a block for an activity of given duration.
 */
function nextSlotInBlock(
  blockStart: string,
  blockEnd: string,
  durationMinutes: number,
  existingActivities: ScheduledActivity[]
): string | null {
  const blockStartMin = timeToMinutes(blockStart);
  const blockEndMin = timeToMinutes(blockEnd);
  let nextFree = blockStartMin;
  const sorted = [...existingActivities].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  for (const a of sorted) {
    const start = timeToMinutes(a.startTime);
    const end = timeToMinutes(a.endTime);
    if (start >= nextFree && start - nextFree >= durationMinutes) {
      return minutesToTime(nextFree);
    }
    nextFree = Math.max(nextFree, end);
  }
  if (blockEndMin - nextFree >= durationMinutes) return minutesToTime(nextFree);
  return null;
}

/**
 * Build day structure with blocks and meal slots from commonActivityHours.
 */
function getDayStructure(
  dayStart: string,
  dayEnd: string
): { blocks: { label: TimeBlockLabel; start: string; end: string }[]; lunch: MealBlock; dinner: MealBlock } {
  const { lunch, dinner } = reserveMealSlotsForDay(dayStart, dayEnd);
  const dayStartMin = timeToMinutes(dayStart);
  const lunchStartMin = timeToMinutes(lunch.startTime);
  const lunchEndMin = timeToMinutes(lunch.endTime);
  const dinnerStartMin = timeToMinutes(dinner.startTime);
  const dinnerEndMin = timeToMinutes(dinner.endTime);
  const dayEndMin = timeToMinutes(dayEnd);

  const blocks: { label: TimeBlockLabel; start: string; end: string }[] = [];
  if (lunchStartMin > dayStartMin) {
    blocks.push({
      label: "morning",
      start: dayStart,
      end: lunch.startTime,
    });
  }
  if (dinnerStartMin > lunchEndMin) {
    blocks.push({
      label: "afternoon",
      start: lunch.endTime,
      end: dinner.startTime,
    });
  }
  if (dayEndMin > dinnerEndMin) {
    blocks.push({
      label: "evening",
      start: dinner.endTime,
      end: dayEnd,
    });
  }
  if (blocks.length === 0) {
    blocks.push({ label: "morning", start: dayStart, end: dayEnd });
  }
  return { blocks, lunch, dinner };
}

function isFoodActivity(candidate: RankedCandidate): boolean {
  const primary = getPrimaryCategory(candidate);
  if (primary === "food") return true;

  // Extra safety: look for food-like hints in categories and name so that
  // restaurant / cafe / dessert places are not missed even if primary category
  // mapping changes.
  const cats = (candidate.categories ?? []).map((c) => c.toLowerCase());
  const name = (candidate.name ?? "").toLowerCase();
  const foodHints = [
    "restaurant",
    "dining",
    "cafe",
    "coffee",
    "bakery",
    "dessert",
    "bistro",
    "brasserie",
    "diner",
    "pub",
    "bar",
    "eatery",
    // Cuisine/meal keywords (helps when Places types are missing, e.g. no API key on Vercel)
    "pizza",
    "sushi",
    "ramen",
    "taco",
    "tapas",
    "steak",
    "grill",
    "bbq",
    "barbecue",
    "teppanyaki",
    "izakaya",
    "trattoria",
    "osteria",
    "kitchen",
    "brunch",
    "breakfast",
    "lunch",
    "dinner",
  ];
  if (cats.some((c) => foodHints.some((h) => c.includes(h)))) return true;
  if (foodHints.some((h) => name.includes(h))) return true;
  return false;
}

/**
 * Assign non-food activities to day blocks (morning/afternoon/evening), respecting duration and max per day.
 */
function assignActivitiesToDays(
  activities: RankedCandidate[],
  tripDays: number,
  dayStart: string,
  dayEnd: string,
  maxNonMealPerDay: number
): Map<number, ScheduledActivity[]> {
  const byDay = new Map<number, ScheduledActivity[]>();
  for (let d = 0; d < tripDays; d++) byDay.set(d, []);

  const structure = getDayStructure(dayStart, dayEnd);
  const used: boolean[] = new Array(activities.length).fill(false);

  for (let dayIdx = 0; dayIdx < tripDays; dayIdx++) {
    const dayActivities = byDay.get(dayIdx)!;
    let count = 0;

    for (const block of structure.blocks) {
      if (count >= maxNonMealPerDay) break;

      let placedInThisBlock = true;
      while (placedInThisBlock && count < maxNonMealPerDay) {
        placedInThisBlock = false;
        let chosenIndex = -1;
        let chosenSlot: string | null = null;
        let chosenDuration = 0;

        for (let i = 0; i < activities.length; i++) {
          if (used[i]) continue;
          const candidate = activities[i]!;
          if (isFoodActivity(candidate)) continue;

          const duration = candidate.estimatedDuration ?? 120;
          const existing = dayActivities.filter((a) => a.blockLabel === block.label);
          const slot = nextSlotInBlock(block.start, block.end, duration, existing);

          if (itineraryDebugEnabled()) {
            // eslint-disable-next-line no-console
            console.log("[itinerary] non-food scheduling attempt", {
              day: dayIdx + 1,
              block: block.label,
              placeId: candidate.placeId,
              name: candidate.name,
              durationMinutes: duration,
              canFit: !!slot,
            });
          }

          if (slot) {
            chosenIndex = i;
            chosenSlot = slot;
            chosenDuration = duration;
            break; // take the first ranked activity that fits this block
          }
        }

        if (chosenIndex === -1 || !chosenSlot) {
          // No remaining candidate can fit in this block; move to next block.
          break;
        }

        const endMin = timeToMinutes(chosenSlot) + chosenDuration;
        const endTime = minutesToTime(endMin);

        dayActivities.push({
          placeId: activities[chosenIndex]!.placeId,
          name: activities[chosenIndex]!.name,
          startTime: chosenSlot,
          endTime,
          durationMinutes: chosenDuration,
          blockLabel: block.label,
          activity: activities[chosenIndex]!,
        });

        used[chosenIndex] = true;
        count++;
        placedInThisBlock = true;
      }
    }
  }
  return byDay;
}

/**
 * Assign food activities to lunch and dinner slots across days.
 */
function assignFoodActivitiesToMealSlots(
  foodActivities: RankedCandidate[],
  tripDays: number,
  dayStart: string,
  dayEnd: string
): Map<number, { lunch?: ScheduledActivity; dinner?: ScheduledActivity }> {
  const result = new Map<number, { lunch?: ScheduledActivity; dinner?: ScheduledActivity }>();
  for (let d = 0; d < tripDays; d++) result.set(d, {});
  const { lunch, dinner } = reserveMealSlotsForDay(dayStart, dayEnd);
  let idx = 0;
  for (let dayIdx = 0; dayIdx < tripDays && idx < foodActivities.length; dayIdx++) {
    const day = result.get(dayIdx)!;
    if (idx < foodActivities.length) {
      const c = foodActivities[idx]!;
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] food scheduling (lunch)", {
          day: dayIdx + 1,
          placeId: c.placeId,
          name: c.name,
          primaryCategory: getPrimaryCategory(c),
          classifiedAsFood: true,
        });
      }
      day.lunch = {
        placeId: c.placeId,
        name: c.name,
        startTime: lunch.startTime,
        endTime: lunch.endTime,
        durationMinutes: MEAL_SLOT_MINUTES,
        blockLabel: "lunch",
        activity: c,
      };
      idx++;
    }
    if (idx < foodActivities.length) {
      const c = foodActivities[idx]!;
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] food scheduling (dinner)", {
          day: dayIdx + 1,
          placeId: c.placeId,
          name: c.name,
          primaryCategory: getPrimaryCategory(c),
          classifiedAsFood: true,
        });
      }
      day.dinner = {
        placeId: c.placeId,
        name: c.name,
        startTime: dinner.startTime,
        endTime: dinner.endTime,
        durationMinutes: MEAL_SLOT_MINUTES,
        blockLabel: "dinner",
        activity: c,
      };
      idx++;
    }
  }
  return result;
}

/**
 * Generate full itinerary: load candidates, re-rank by votes, remove bottom 5,
 * split food vs non-food, assign to days with blocks and meal slots.
 */
export async function generateItinerary(tripId: string): Promise<Itinerary | null> {
  const trip = getTripById(tripId);
  const profile = generateGroupPlanningProfile(tripId);
  if (!trip || !profile) return null;

  const candidates = await getRankedVoteCandidates(tripId);
  if (candidates.length === 0) return null;

  const voteRanked = rankActivitiesFromVotes(candidates, tripId);
  const afterRemoval = removeLowestRankedActivities(voteRanked, REMOVE_BOTTOM_N);
  if (afterRemoval.length === 0) return null;

  const tripDays = Math.max(1, trip.tripDays ?? 3);
  let dayStart = profile.commonActiveHours?.start ?? "09:00";
  let dayEnd = profile.commonActiveHours?.end ?? "21:00";
  if (timeToMinutes(dayStart) >= timeToMinutes(dayEnd)) {
    if (itineraryDebugEnabled()) {
      // eslint-disable-next-line no-console
      console.warn("[itinerary] invalid commonActiveHours (empty overlap?), using 09:00–21:00", {
        tripId,
        was: { dayStart, dayEnd },
      });
    }
    dayStart = "09:00";
    dayEnd = "21:00";
  }
  const energyLevel = (profile.groupEnergyLevel ?? "medium").toLowerCase() as "low" | "medium" | "high";
  const maxNonMealPerDay = getMaxActivitiesPerDayByEnergyLevel(profile.groupEnergyLevel ?? "medium");

  if (itineraryDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[itinerary] max non-meal activities per day", {
      tripId,
      tripDays,
      groupEnergyLevel: profile.groupEnergyLevel ?? "medium",
      maxNonMealPerDay,
    });
    // eslint-disable-next-line no-console
    console.log(
      "[itinerary] food classification snapshot",
      afterRemoval.map((a) => ({
        placeId: a.placeId,
        name: a.name,
        primaryCategory: getPrimaryCategory(a),
        classifiedAsFood: isFoodActivity(a),
      }))
    );
    // eslint-disable-next-line no-console
    console.log(
      "[itinerary] ranked activities after vote + bottom-5 removal",
      afterRemoval.map((a, idx) => ({
        index: idx + 1,
        placeId: a.placeId,
        name: a.name,
      }))
    );
  }

  const foodActivities = afterRemoval.filter(isFoodActivity);
  let nonFoodActivities = afterRemoval.filter((a) => !isFoodActivity(a));

  if (itineraryDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[itinerary] meal pipeline split", {
      tripId,
      afterVoteAndBottomRemoval: afterRemoval.length,
      foodPlaces: foodActivities.length,
      nonFoodPlaces: nonFoodActivities.length,
      note:
        foodActivities.length === 0
          ? "No food in voted list — lunch/dinner depend on Places restaurant search (API key + searchText must work)."
          : "Food from votes fills some meal slots; empty slots use restaurant search.",
    });
  }

  const { clusters, noLocation } = clusterActivitiesByLocation(nonFoodActivities);
  const byPlaceId = new Map(nonFoodActivities.map((a) => [a.placeId, a]));
  const ordered: RankedCandidate[] = [];
  for (const placeIds of clusters) {
    for (const id of placeIds) {
      const a = byPlaceId.get(id);
      if (a) ordered.push(a);
    }
  }
  for (const id of noLocation) {
    const a = byPlaceId.get(id);
    if (a) ordered.push(a);
  }
  nonFoodActivities = ordered.length > 0 ? ordered : nonFoodActivities;

  const nonFoodByDay = assignActivitiesToDays(
    nonFoodActivities,
    tripDays,
    dayStart,
    dayEnd,
    maxNonMealPerDay
  );
  const foodByDay = assignFoodActivitiesToMealSlots(
    foodActivities,
    tripDays,
    dayStart,
    dayEnd
  );

  const structure = getDayStructure(dayStart, dayEnd);
  const days: ItineraryDay[] = [];

  for (let i = 0; i < tripDays; i++) {
    const dayNonFood = nonFoodByDay.get(i) ?? [];
    const dayFood = foodByDay.get(i) ?? {};
    const blocks: ItineraryBlock[] = structure.blocks.map((b) => ({
      label: b.label,
      startTime: b.start,
      endTime: b.end,
      activities: dayNonFood.filter((a) => a.blockLabel === b.label),
    }));
    days.push({
      dayIndex: i + 1,
      startTime: dayStart,
      endTime: dayEnd,
      blocks,
      lunchSlot: { ...structure.lunch, activity: dayFood.lunch },
      dinnerSlot: { ...structure.dinner, activity: dayFood.dinner },
      energyLevel,
      maxNonMealActivities: maxNonMealPerDay,
    });
  }

  // Auto-fill any empty meal slots with restaurant recommendations so that
  // every day has both lunch and dinner.
  for (const day of days) {
    const allActivitiesForDay = day.blocks.flatMap((b) => b.activities);

    async function recommendForSlot(
      slot: "lunch" | "dinner",
      startTime: string,
      existingActivity: ScheduledActivity | undefined
    ): Promise<ScheduledActivity | undefined> {
      if (existingActivity) return existingActivity;

      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] meal slot empty \u2192 triggering restaurant search", {
          tripId,
          dayIndex: day.dayIndex,
          slot,
        });
      }

      const slotMinutes = timeToMinutes(startTime);
      // 1. Prefer last activity before the meal
      let ref: ScheduledActivity | undefined = allActivitiesForDay
        .filter((a) => timeToMinutes(a.endTime) <= slotMinutes)
        .sort((a, b) => timeToMinutes(b.endTime) - timeToMinutes(a.endTime))[0];

      // 2. Otherwise, take first activity after the meal
      if (!ref) {
        ref = allActivitiesForDay
          .filter((a) => timeToMinutes(a.startTime) >= slotMinutes)
          .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0];
      }

      let refLat: number | null = null;
      let refLng: number | null = null;
      if (ref?.activity.location) {
        refLat = ref.activity.location.lat;
        refLng = ref.activity.location.lng;
      }

      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] restaurant search location", {
          dayIndex: day.dayIndex,
          slot,
          refActivity: ref ? { placeId: ref.placeId, name: ref.name } : null,
          refLat,
          refLng,
        });
      }

      const restaurants = await fetchRestaurantCandidatesForDestination(
        profile.destination,
        20
      );

      const budget = (profile.groupBudgetLevel ?? "moderate").toLowerCase();
      const strictCostLevels =
        budget === "budget"
          ? ["low"]
          : budget === "luxury"
            ? ["medium", "high"]
            : ["low", "medium", "high"];
      const relaxedCostLevels = ["low", "medium", "high"];

      type MealSearchTier = {
        minRating: number;
        /** Max distance from reference activity; null = ignore distance */
        radiusKm: number | null;
        costLevels: string[];
        label: string;
      };

      const tiers: MealSearchTier[] = [
        { minRating: 4, radiusKm: 2.5, costLevels: strictCostLevels, label: "strict" },
        { minRating: 4, radiusKm: 5, costLevels: strictCostLevels, label: "wider-5km" },
        { minRating: 3.5, radiusKm: 8, costLevels: strictCostLevels, label: "rating3.5-8km" },
        { minRating: 3.5, radiusKm: null, costLevels: strictCostLevels, label: "rating3.5-city" },
        { minRating: 3, radiusKm: null, costLevels: relaxedCostLevels, label: "relaxed-budget" },
        { minRating: 0, radiusKm: null, costLevels: relaxedCostLevels, label: "any-rated-food" },
      ];

      let filtered: CandidateActivity[] = [];
      let usedTier = "";

      for (const tier of tiers) {
        filtered = restaurants.filter((r) => {
          if (!isFoodActivity(r as RankedCandidate)) return false;
          if (tier.minRating > 0) {
            if (r.rating === undefined || r.rating === null || r.rating < tier.minRating) {
              return false;
            }
          }
          if (!tier.costLevels.includes(r.costLevel)) return false;
          if (r.tags && r.tags.some((t) => profile.excludedTags.includes(t))) return false;
          if (tier.radiusKm != null && refLat != null && refLng != null && r.location) {
            const dKm = haversineKm(refLat, refLng, r.location.lat, r.location.lng);
            if (dKm > tier.radiusKm) return false;
          }
          return true;
        });
        if (filtered.length > 0) {
          usedTier = tier.label;
          break;
        }
      }

      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] restaurant candidates found", {
          dayIndex: day.dayIndex,
          slot,
          total: restaurants.length,
          afterFilter: filtered.length,
          tier: usedTier || "none",
        });
      }

      if (filtered.length === 0) return existingActivity;

      const ranked = filtered
        .map((r) => {
          let distanceKm = 0;
          if (refLat != null && refLng != null && r.location) {
            distanceKm = haversineKm(refLat, refLng, r.location.lat, r.location.lng);
          }
          return { r, distanceKm };
        })
        .sort((a, b) => {
          const ra = a.r.rating ?? 0;
          const rb = b.r.rating ?? 0;
          if (rb !== ra) return rb - ra;
          return a.distanceKm - b.distanceKm;
        });

      const chosen = ranked[0]!;
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] selected restaurant", {
          dayIndex: day.dayIndex,
          slot,
          placeId: chosen.r.placeId,
          name: chosen.r.name,
          rating: chosen.r.rating,
          distanceKm: chosen.distanceKm,
        });
      }

      return {
        placeId: chosen.r.placeId,
        name: chosen.r.name,
        startTime,
        endTime: minutesToTime(timeToMinutes(startTime) + MEAL_SLOT_MINUTES),
        durationMinutes: MEAL_SLOT_MINUTES,
        blockLabel: slot,
        activity: {
          ...chosen.r,
          source: "auto_recommendation",
        } as CandidateActivity,
      };
    }

    if (!day.lunchSlot.activity) {
      const rec = await recommendForSlot("lunch", day.lunchSlot.startTime, day.lunchSlot.activity);
      if (rec) day.lunchSlot.activity = rec;
    }
    if (!day.dinnerSlot.activity) {
      const rec = await recommendForSlot("dinner", day.dinnerSlot.startTime, day.dinnerSlot.activity);
      if (rec) day.dinnerSlot.activity = rec;
    }
  }

  return {
    tripId,
    days,
    activityOrder: afterRemoval.map((a) => a.placeId),
  };
}

const ITINERARY_STORAGE_KEY = "tripItineraries";

function getItinerariesStorage(): Itinerary[] {
  try {
    const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setItinerariesStorage(list: Itinerary[]) {
  localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(list));
}

/**
 * Save generated itinerary for a trip (overwrites existing for that tripId).
 */
export function saveItinerary(itinerary: Itinerary): void {
  const now = new Date().toISOString();
  const list = getItinerariesStorage().filter((i) => i.tripId !== itinerary.tripId);
  const withMeta: Itinerary = {
    ...itinerary,
    savedAt: itinerary.savedAt ?? now,
    updatedAt: now,
  };
  list.push(withMeta);
  setItinerariesStorage(list);
}

/**
 * Get itinerary for a trip if it exists.
 */
export function getItinerary(tripId: string): Itinerary | null {
  return getItinerariesStorage().find((i) => i.tripId === tripId) ?? null;
}
