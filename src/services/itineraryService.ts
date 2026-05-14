import { getTripById, getTripMembers } from "./tripService";
import { getRankedVoteCandidates } from "./activityEngine";
import { getPrimaryCategory } from "./activityEngine";
import { generateGroupPlanningProfile } from "./planningService";
import { getMemberPreferencesByTripId } from "./preferenceService";
import { getAggregatedVotesByTripId, getVotesByTripId } from "./voteService";
import { getAIVotingRecommendations } from "./votingRecommendationService";
import { evaluateSplitGroupPlan } from "./splitGroupPlanService";
import { evaluateDailyCapacity } from "./dailyCapacityService";
import { expandFoodActivitiesWithAiMealGap } from "./mealFoodGapFillService";
import {
  buildScheduledDaysForSchedulerPayload,
  buildSchedulerGroupContextPayload,
  candidatesBriefFromPool,
  fetchItinerarySchedulerDayInsights,
} from "./itineraryDayReasoningService";
import { ACTIVITIES_PER_DAY_BY_ENERGY } from "./planningService";
import type { RankedCandidate } from "../types/activity";
import type { GroupPlanningProfile } from "../types/preference";
import type { SplitGroupPlanEvaluation } from "../types/splitGroupPlan";
import type {
  Itinerary,
  ItineraryBlock,
  ItineraryDay,
  ItineraryTransitLeg,
  ItineraryTransitSnapshot,
  MealBlock,
  ScheduledActivity,
  TimeBlockLabel,
} from "../types/itinerary";
import { cloudUpsertTripItinerary, isItineraryCloudEnabled } from "./itineraryCloudStore";
import type { TransitInfo } from "./transitService";

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

function normalizePickLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesGooglePlaceRef(selected: string, placeId: string): boolean {
  const t = String(selected).trim();
  if (!t) return false;
  const nid = t.replace(/^places\//, "");
  if (t.startsWith("places/") || nid.startsWith("ChIJ")) {
    return nid === placeId || placeId.includes(nid) || nid.includes(placeId);
  }
  return false;
}

function wasExplicitlyBackedByMemberPrefs(
  c: RankedCandidate,
  tripId: string,
  profile: GroupPlanningProfile
): boolean {
  if (c.isSelectedByAnyMember || c.selectedCount > 0) return true;
  const normName = normalizePickLabel(c.name);
  for (const place of profile.candidatePlaces ?? []) {
    if (normalizePickLabel(String(place)) === normName) return true;
  }
  for (const pref of getMemberPreferencesByTripId(tripId)) {
    for (const sp of pref.selectedPlaces ?? []) {
      const raw = String(sp).trim();
      if (!raw) continue;
      if (normalizePickLabel(raw) === normName) return true;
      if (matchesGooglePlaceRef(raw, c.placeId)) return true;
    }
  }
  return false;
}

function partitionVoteCandidatesForItinerary(
  voteRanked: RankedCandidate[],
  tripId: string,
  profile: GroupPlanningProfile
): { groupCandidates: RankedCandidate[]; splitCandidates: RankedCandidate[]; removedPlaceIds: string[] } {
  const agg = getAggregatedVotesByTripId(tripId);
  const groupCandidates: RankedCandidate[] = [];
  const splitCandidates: RankedCandidate[] = [];
  const removedPlaceIds: string[] = [];

  for (const c of voteRanked) {
    const v = agg[c.placeId] ?? { up: 0, down: 0 };
    const total = v.up + v.down;
    const downRatio = total === 0 ? 0 : v.down / total;
    const excludedFromGroup = total > 0 && downRatio > 0.5;
    const stamped: RankedCandidate = { ...c, excludedFromGroup };

    if (!excludedFromGroup) {
      groupCandidates.push({ ...stamped, excludedFromGroup: false });
    } else if (wasExplicitlyBackedByMemberPrefs(c, tripId, profile)) {
      splitCandidates.push(stamped);
    } else {
      removedPlaceIds.push(c.placeId);
    }
  }
  return { groupCandidates, splitCandidates, removedPlaceIds };
}

async function ensureGroupNonFoodPoolMeetsDays(args: {
  tripId: string;
  groupCandidates: RankedCandidate[];
  minNonFoodSlots: number;
  removedPlaceIds: string[];
}): Promise<RankedCandidate[]> {
  const minNonFood = Math.max(1, args.minNonFoodSlots);
  const group = [...args.groupCandidates];
  const nonFoodCount = () => group.filter((a) => !isFoodActivity(a)).length;
  if (nonFoodCount() >= minNonFood) return group;

  const additions = await getAIVotingRecommendations(args.tripId, {
    excludePlaceIds: [...new Set(args.removedPlaceIds)],
  });
  for (const row of additions) {
    if (group.some((g) => g.placeId === row.placeId)) continue;
    group.push({ ...row, excludedFromGroup: false });
    if (nonFoodCount() >= minNonFood) break;
  }
  return group;
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

/** How `timeWindow` maps to internal morning/afternoon/evening blocks for placement. */
type AssignActivitiesWindowMode = "common_hours" | "split_subgroup";

/**
 * For subgroup windows, avoid global lunch/dinner boundaries leaking outside the window;
 * use one schedulable span so activities stay within [start, end].
 */
function getSplitSubgroupSchedulingBlocks(
  winStart: string,
  winEnd: string
): { label: TimeBlockLabel; start: string; end: string }[] {
  if (timeToMinutes(winEnd) <= timeToMinutes(winStart)) {
    return [{ label: "morning", start: winStart, end: winEnd }];
  }
  return [{ label: "morning", start: winStart, end: winEnd }];
}

function inferBlockLabelForCommonDay(
  startTime: string,
  blocks: { label: TimeBlockLabel; start: string; end: string }[]
): TimeBlockLabel {
  const sm = timeToMinutes(startTime);
  for (const b of blocks) {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    if (sm >= bs && sm < be) return b.label;
  }
  return blocks.length > 0 ? blocks[blocks.length - 1]!.label : "afternoon";
}

/**
 * Assign non-food activities to day blocks (morning/afternoon/evening), respecting duration and max per day.
 * `timeWindow` is the schedulable clock span for this batch (group = common overlap; split = subgroup window).
 * `windowMode` selects how that span is subdivided into blocks.
 */
function assignActivitiesToDays(
  activities: RankedCandidate[],
  tripDays: number,
  timeWindow: { start: string; end: string },
  maxPerDayByDayIndex: readonly number[],
  windowMode: AssignActivitiesWindowMode
): Map<number, ScheduledActivity[]> {
  const { start: dayStart, end: dayEnd } = timeWindow;
  const blocks =
    windowMode === "common_hours"
      ? getDayStructure(dayStart, dayEnd).blocks
      : getSplitSubgroupSchedulingBlocks(dayStart, dayEnd);

  const byDay = new Map<number, ScheduledActivity[]>();
  for (let d = 0; d < tripDays; d++) byDay.set(d, []);

  const used: boolean[] = new Array(activities.length).fill(false);

  for (let dayIdx = 0; dayIdx < tripDays; dayIdx++) {
    const dayActivities = byDay.get(dayIdx)!;
    let count = 0;
    const dayCap =
      maxPerDayByDayIndex[dayIdx] ??
      maxPerDayByDayIndex[maxPerDayByDayIndex.length - 1] ??
      3;

    for (const block of blocks) {
      if (count >= dayCap) break;

      let placedInThisBlock = true;
      while (placedInThisBlock && count < dayCap) {
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
 * Last non-food activity that ends at or before lunch start (closest to lunch from the morning side).
 */
function getReferenceActivityBeforeLunch(
  dayNonFood: ScheduledActivity[],
  lunchStartTime: string
): ScheduledActivity | undefined {
  const lunchMin = timeToMinutes(lunchStartTime);
  let best: ScheduledActivity | undefined;
  let bestEnd = -1;
  for (const a of dayNonFood) {
    const end = timeToMinutes(a.endTime);
    if (end <= lunchMin && end >= bestEnd) {
      bestEnd = end;
      best = a;
    }
  }
  return best;
}

/**
 * First non-food activity that starts at or after dinner end (closest after dinner).
 */
function getReferenceActivityAfterDinner(
  dayNonFood: ScheduledActivity[],
  dinnerEndTime: string
): ScheduledActivity | undefined {
  const dinnerEndMin = timeToMinutes(dinnerEndTime);
  let best: ScheduledActivity | undefined;
  let bestStart = Number.POSITIVE_INFINITY;
  for (const a of dayNonFood) {
    const start = timeToMinutes(a.startTime);
    if (start >= dinnerEndMin && start < bestStart) {
      bestStart = start;
      best = a;
    }
  }
  return best;
}

const MEAL_PROXIMITY_PREFER_KM = 1.5;

function foodDistanceToRefKm(food: RankedCandidate, ref: ScheduledActivity): number {
  const rLoc = ref.activity?.location;
  const fLoc = food.location;
  if (
    !rLoc ||
    typeof rLoc.lat !== "number" ||
    typeof rLoc.lng !== "number" ||
    !fLoc ||
    typeof fLoc.lat !== "number" ||
    typeof fLoc.lng !== "number"
  ) {
    return Number.POSITIVE_INFINITY;
  }
  return haversineKm(rLoc.lat, rLoc.lng, fLoc.lat, fLoc.lng);
}

/**
 * Pick next unused food index: by proximity to ref when ref has coordinates; otherwise earliest unused index (priority order).
 */
function pickNextFoodIndexForMealSlot(
  foodActivities: RankedCandidate[],
  usedFoodIndices: Set<number>,
  ref: ScheduledActivity | undefined
): number | null {
  const indices: number[] = [];
  for (let i = 0; i < foodActivities.length; i++) {
    if (!usedFoodIndices.has(i)) indices.push(i);
  }
  if (indices.length === 0) return null;

  const refHasCoords = Boolean(
    ref?.activity?.location &&
      typeof ref.activity.location.lat === "number" &&
      typeof ref.activity.location.lng === "number"
  );

  if (!refHasCoords) {
    return Math.min(...indices);
  }

  const scored = indices.map((i) => ({
    i,
    dKm: foodDistanceToRefKm(foodActivities[i]!, ref!),
  }));

  scored.sort((a, b) => {
    const aIn = a.dKm <= MEAL_PROXIMITY_PREFER_KM;
    const bIn = b.dKm <= MEAL_PROXIMITY_PREFER_KM;
    if (aIn !== bIn) return aIn ? -1 : 1;
    if (a.dKm !== b.dKm) return a.dKm - b.dKm;
    return a.i - b.i;
  });

  return scored[0]!.i;
}

/**
 * Assign food activities to lunch and dinner slots across days.
 */
function assignFoodActivitiesToMealSlots(
  foodActivities: RankedCandidate[],
  nonFoodByDay: Map<number, ScheduledActivity[]>,
  tripDays: number,
  dayStart: string,
  dayEnd: string
): Map<number, { lunch?: ScheduledActivity; dinner?: ScheduledActivity }> {
  const result = new Map<number, { lunch?: ScheduledActivity; dinner?: ScheduledActivity }>();
  for (let d = 0; d < tripDays; d++) result.set(d, {});
  const { lunch, dinner } = reserveMealSlotsForDay(dayStart, dayEnd);
  const usedFoodIndices = new Set<number>();

  for (let dayIdx = 0; dayIdx < tripDays; dayIdx++) {
    const day = result.get(dayIdx)!;
    const dayNonFood = [...(nonFoodByDay.get(dayIdx) ?? [])].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    const lunchRef = getReferenceActivityBeforeLunch(dayNonFood, lunch.startTime);
    const lunchIdx = pickNextFoodIndexForMealSlot(foodActivities, usedFoodIndices, lunchRef);
    if (lunchIdx != null) {
      const c = foodActivities[lunchIdx]!;
      usedFoodIndices.add(lunchIdx);
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] food scheduling (lunch)", {
          day: dayIdx + 1,
          placeId: c.placeId,
          name: c.name,
          primaryCategory: getPrimaryCategory(c),
          classifiedAsFood: true,
          proximityRef: lunchRef
            ? { placeId: lunchRef.placeId, name: lunchRef.name, hasCoords: Boolean(lunchRef.activity?.location) }
            : null,
          distanceKm:
            lunchRef && lunchRef.activity?.location && c.location
              ? foodDistanceToRefKm(c, lunchRef)
              : null,
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
    }

    const dinnerRef = getReferenceActivityAfterDinner(dayNonFood, dinner.endTime);
    const dinnerIdx = pickNextFoodIndexForMealSlot(foodActivities, usedFoodIndices, dinnerRef);
    if (dinnerIdx != null) {
      const c = foodActivities[dinnerIdx]!;
      usedFoodIndices.add(dinnerIdx);
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] food scheduling (dinner)", {
          day: dayIdx + 1,
          placeId: c.placeId,
          name: c.name,
          primaryCategory: getPrimaryCategory(c),
          classifiedAsFood: true,
          proximityRef: dinnerRef
            ? { placeId: dinnerRef.placeId, name: dinnerRef.name, hasCoords: Boolean(dinnerRef.activity?.location) }
            : null,
          distanceKm:
            dinnerRef && dinnerRef.activity?.location && c.location
              ? foodDistanceToRefKm(c, dinnerRef)
              : null,
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
    }
  }
  return result;
}

function splitPlanUsesSubgroupWindows(
  splitPlan: SplitGroupPlanEvaluation
): splitPlan is Extract<SplitGroupPlanEvaluation, { needsSplit: true }> {
  return (
    splitPlan.needsSplit === true &&
    Array.isArray(splitPlan.splitGroups) &&
    splitPlan.splitGroups.length > 0
  );
}

/**
 * Generate full itinerary: load candidates, re-rank by votes, split majority-downvoted
 * places into group vs member-split pools, optionally AI gap-fill for the group pool,
 * then split food vs non-food and assign to days with blocks and meal slots.
 */
export async function generateItinerary(tripId: string): Promise<Itinerary | null> {
  const trip = getTripById(tripId);
  const profile = generateGroupPlanningProfile(tripId);
  if (!trip || !profile) return null;

  const candidates = await getRankedVoteCandidates(tripId);
  if (candidates.length === 0) return null;

  const voteRanked = rankActivitiesFromVotes(candidates, tripId);

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

  const { groupCandidates: groupPartitioned, splitCandidates, removedPlaceIds } =
    partitionVoteCandidatesForItinerary(voteRanked, tripId, profile);

  const splitPlan = await evaluateSplitGroupPlan(tripId, groupPartitioned, splitCandidates, profile);
  const splitExists = splitPlanUsesSubgroupWindows(splitPlan);

  const minNonFoodSlots = Math.max(
    1,
    tripDays * getMaxActivitiesPerDayByEnergyLevel(profile.groupEnergyLevel ?? "medium")
  );

  const groupCandidates = await ensureGroupNonFoodPoolMeetsDays({
    tripId,
    groupCandidates: groupPartitioned,
    minNonFoodSlots,
    removedPlaceIds,
  });

  const schedulingPool = [...groupCandidates, ...splitCandidates];
  if (schedulingPool.length === 0) return null;

  const dailyCapacity = await evaluateDailyCapacity(profile, tripDays, schedulingPool, splitExists);


  if (itineraryDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[itinerary] daily non-meal capacity", {
      tripId,
      tripDays,
      source: dailyCapacity.source,
      dayVariance: dailyCapacity.dayVariance,
      maxPerDay: dailyCapacity.maxPerDayByDayIndex,
      reasoning: dailyCapacity.reasoning,
    });
    // eslint-disable-next-line no-console
    console.log("[itinerary] max non-meal activities per day (legacy energy cap for reference)", {
      tripId,
      tripDays,
      groupEnergyLevel: profile.groupEnergyLevel ?? "medium",
      energyHeuristicMax: getMaxActivitiesPerDayByEnergyLevel(profile.groupEnergyLevel ?? "medium"),
    });
    // eslint-disable-next-line no-console
    console.log(
      "[itinerary] food classification snapshot",
      schedulingPool.map((a) => ({
        placeId: a.placeId,
        name: a.name,
        primaryCategory: getPrimaryCategory(a),
        classifiedAsFood: isFoodActivity(a),
      }))
    );
    // eslint-disable-next-line no-console
    console.log("[itinerary] vote trim: group vs split pools", {
      tripId,
      groupCount: groupCandidates.length,
      splitCount: splitCandidates.length,
      removedMajorityDown: removedPlaceIds.length,
      aiGapFilled: groupCandidates.length - groupPartitioned.length,
      splitPlanNeedsSplit: splitPlan.needsSplit,
    });
    // eslint-disable-next-line no-console
    console.log(
      "[itinerary] scheduling pool (group then split)",
      schedulingPool.map((a, idx) => ({
        index: idx + 1,
        placeId: a.placeId,
        name: a.name,
        excludedFromGroup: a.excludedFromGroup ?? false,
      }))
    );
  }

  let foodActivities = schedulingPool.filter(isFoodActivity);
  foodActivities = await expandFoodActivitiesWithAiMealGap({
    destination: profile.destination,
    profile,
    tripDays,
    foodActivities,
  });
  let nonFoodActivities = schedulingPool.filter((a) => !isFoodActivity(a));

  if (itineraryDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[itinerary] meal pipeline split", {
      tripId,
      schedulingPool: schedulingPool.length,
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

  const commonWindow = { start: dayStart, end: dayEnd };

  let nonFoodByDay: Map<number, ScheduledActivity[]>;

  if (!splitPlanUsesSubgroupWindows(splitPlan)) {
    nonFoodByDay = assignActivitiesToDays(
      nonFoodActivities,
      tripDays,
      commonWindow,
      dailyCapacity.maxPerDayByDayIndex,
      "common_hours"
    );
  } else {
    const displayBlockDefs = getDayStructure(dayStart, dayEnd).blocks;
    const sp = splitPlan;
    const groupPlaceIds = new Set(groupCandidates.map((c) => c.placeId));
    const groupNonFood = nonFoodActivities.filter((a) => groupPlaceIds.has(a.placeId));
    nonFoodByDay = new Map();
    for (let d = 0; d < tripDays; d++) nonFoodByDay.set(d, []);
    const assignedPlaceIds = new Set<string>();

    const mergeMaps = (m: Map<number, ScheduledActivity[]>) => {
      for (let d = 0; d < tripDays; d++) {
        const add = m.get(d) ?? [];
        if (add.length === 0) continue;
        const cur = nonFoodByDay.get(d) ?? [];
        cur.push(...add);
        nonFoodByDay.set(d, cur);
        for (const a of add) assignedPlaceIds.add(a.placeId);
      }
    };

    mergeMaps(
      assignActivitiesToDays(
        groupNonFood,
        tripDays,
        commonWindow,
        dailyCapacity.maxPerDayByDayIndex,
        "common_hours"
      )
    );

    for (const sg of sp.splitGroups) {
      const tw = sg.timeWindow;
      const wStart =
        typeof tw?.start === "string" && tw.start.trim() ? tw.start.trim() : dayStart;
      const wEnd = typeof tw?.end === "string" && tw.end.trim() ? tw.end.trim() : dayEnd;
      if (timeToMinutes(wEnd) <= timeToMinutes(wStart)) continue;

      const splitActs = nonFoodActivities.filter((a) => (sg.activities ?? []).includes(a.placeId));
      if (splitActs.length === 0) continue;

      mergeMaps(
        assignActivitiesToDays(
          splitActs,
          tripDays,
          { start: wStart, end: wEnd },
          dailyCapacity.maxPerDayByDayIndex,
          "split_subgroup"
        )
      );
    }

    const orphanNonFood = nonFoodActivities.filter((a) => !assignedPlaceIds.has(a.placeId));
    if (orphanNonFood.length > 0) {
      mergeMaps(
        assignActivitiesToDays(
          orphanNonFood,
          tripDays,
          commonWindow,
          dailyCapacity.maxPerDayByDayIndex,
          "common_hours"
        )
      );
    }

    for (let d = 0; d < tripDays; d++) {
      const list = nonFoodByDay.get(d) ?? [];
      list.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      for (const a of list) {
        a.blockLabel = inferBlockLabelForCommonDay(a.startTime, displayBlockDefs);
      }
      nonFoodByDay.set(d, list);
    }
  }
  const foodByDay = assignFoodActivitiesToMealSlots(
    foodActivities,
    nonFoodByDay,
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
      maxNonMealActivities: dailyCapacity.maxPerDayByDayIndex[i] ?? dailyCapacity.maxActivitiesPerDay,
    });
  }

  const votes = getVotesByTripId(tripId);
  const members = getTripMembers(tripId);
  const memberPrefs = getMemberPreferencesByTripId(tripId);
  const scheduledPayload = buildScheduledDaysForSchedulerPayload(tripId, days, votes, members);
  const groupPayload = buildSchedulerGroupContextPayload({
    tripId,
    profile,
    splitPlan,
    dailyCapacityReasoning: dailyCapacity.reasoning,
    members,
    memberPreferences: memberPrefs,
    candidatesBrief: candidatesBriefFromPool(schedulingPool),
  });

  const insights = await fetchItinerarySchedulerDayInsights({
    tripDays,
    tripName: trip.name,
    destination: profile.destination,
    groupContext: groupPayload,
    scheduledDays: scheduledPayload,
  });

  let finalDays = days;
  if (insights && insights.length === tripDays) {
    const byNum = new Map(insights.map((x) => [x.dayNumber, x]));
    finalDays = days.map((d) => {
      const ins = byNum.get(d.dayIndex);
      if (!ins) return d;
      return {
        ...d,
        dayTheme: ins.theme,
        dayReasoning: ins.dayReasoning,
      };
    });
  }

  return {
    tripId,
    days: finalDays,
    splitPlan,
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
 * Merge itinerary from cloud when newer than local (by updatedAt / savedAt ISO).
 * Does not push to cloud (avoids loops). Returns true if local storage was updated.
 */
export function mergeItineraryFromCloudIfNewer(incoming: Itinerary): boolean {
  const local = getItinerary(incoming.tripId);
  const inT = incoming.updatedAt ?? incoming.savedAt ?? "";
  const loT = local?.updatedAt ?? local?.savedAt ?? "";
  if (!local) {
    const list = getItinerariesStorage().filter((i) => i.tripId !== incoming.tripId);
    list.push(incoming);
    setItinerariesStorage(list);
    return true;
  }
  if (inT && (!loT || inT > loT)) {
    const list = getItinerariesStorage().filter((i) => i.tripId !== incoming.tripId);
    list.push(incoming);
    setItinerariesStorage(list);
    return true;
  }
  return false;
}

/**
 * Persist computed inter-stop transit on the itinerary (local + cloud when enabled).
 * Skips if snapshot for this layout is already stored.
 */
export function upsertItineraryTransitSnapshot(args: {
  tripId: string;
  layoutFingerprint: string;
  transitByDay: Record<number, TransitInfo[]>;
  adjustedStartByDay: Record<number, string[]>;
}): void {
  const it = getItinerary(args.tripId);
  if (!it) return;
  if (it.transitSnapshot?.layoutFingerprint === args.layoutFingerprint) return;

  const transitByDay: Record<string, ItineraryTransitLeg[]> = {};
  for (const [k, v] of Object.entries(args.transitByDay)) {
    transitByDay[String(k)] = v.map((leg) => ({
      minutes: leg.minutes,
      method: leg.method,
      source: leg.source,
    }));
  }
  const adjustedStartByDay: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(args.adjustedStartByDay)) {
    adjustedStartByDay[String(k)] = v;
  }
  const transitSnapshot: ItineraryTransitSnapshot = {
    layoutFingerprint: args.layoutFingerprint,
    transitByDay,
    adjustedStartByDay,
  };
  saveItinerary({ ...it, transitSnapshot });
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

  if (isItineraryCloudEnabled()) {
    void cloudUpsertTripItinerary(withMeta);
  }
}

/**
 * Get itinerary for a trip if it exists.
 */
export function getItinerary(tripId: string): Itinerary | null {
  return getItinerariesStorage().find((i) => i.tripId === tripId) ?? null;
}
