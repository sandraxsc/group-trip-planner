import { getTripById } from "./tripService";
import { getMemberPreferencesByTripId } from "./preferenceService";
import type { GroupPlanningProfile } from "../types/preference";
import type { MemberPreference } from "../types/preference";

/**
 * GroupPlanningProfile derivation (see types/preference.ts for full rules):
 * - tripId, destination: From Trip.
 * - groupBudgetLevel: Median budgetLevel across members (ordinal rank → median → back to string).
 * - groupEnergyLevel: Median energyLevel across members (ordinal rank → median → back to string).
 * - commonActiveHours: Latest start, earliest end across members (overlapping window).
 * - commonActivityTypes: Union of all members' activityTypes.
 * - excludedTags: Union of all members' dealBreakers.
 * - candidatePlaces: Union of all members' selectedPlaces.
 *
 * Used with Google Places API: groupBudgetLevel/COST_RANGE_BY_BUDGET, commonActivityTypes, excludedTags, candidatePlaces, commonActiveHours for scheduling.
 */

/**
 * Map energy level to suggested activities-per-day range (for itinerary logic).
 * low -> 1-2, medium -> 2-3, high -> 3-5.
 */
export const ACTIVITIES_PER_DAY_BY_ENERGY: Record<
  string,
  { min: number; max: number }
> = {
  low: { min: 1, max: 2 },
  medium: { min: 2, max: 3 },
  high: { min: 3, max: 5 },
};

/**
 * Map budget level to approximate cost range per day (for filtering/display).
 * Can be used with Places API price_level or estimated costs.
 */
export const COST_RANGE_BY_BUDGET: Record<
  string,
  { minPerDay?: number; maxPerDay?: number }
> = {
  budget: { maxPerDay: 50 },
  moderate: { minPerDay: 50, maxPerDay: 150 },
  luxury: { minPerDay: 150 },
};

/**
 * Compare two "HH:mm" strings. Returns true if a <= b (a is same or earlier).
 */
function timeLte(a: string, b: string): boolean {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah < bh || (ah === bh && am <= bm);
}

/**
 * Compare two "HH:mm" strings. Returns true if a >= b (a is same or later).
 */
function timeGte(a: string, b: string): boolean {
  return !timeLte(a, b) || a === b;
}

/**
 * Common active hours: latest start and earliest end across members (true overlapping time window).
 * If no members have activeHours, returns default 09:00–21:00.
 */
function overlappingActiveHours(
  hours: Array<{ start: string; end: string }>
): { start: string; end: string } {
  if (hours.length === 0) {
    return { start: "09:00", end: "21:00" };
  }
  let start = hours[0].start;
  let end = hours[0].end;
  for (let i = 1; i < hours.length; i++) {
    if (timeGte(hours[i].start, start)) start = hours[i].start;
    if (timeLte(hours[i].end, end)) end = hours[i].end;
  }
  return { start, end };
}

/** Ordinal rank for budget: budget=1, moderate=2, luxury=3. */
const BUDGET_RANK: Record<string, number> = {
  budget: 1,
  moderate: 2,
  luxury: 3,
};
const BUDGET_BY_RANK: Record<number, string> = {
  1: "budget",
  2: "moderate",
  3: "luxury",
};

/** Ordinal rank for energy: low=1, medium=2, high=3. */
const ENERGY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};
const ENERGY_BY_RANK: Record<number, string> = {
  1: "low",
  2: "medium",
  3: "high",
};

/**
 * Median of an array of numbers. For even length, returns the lower middle value (e.g. [1,2,3,4] → 2).
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : sorted[mid - 1]!;
}

/**
 * Derive group level from ordinal string values: map to ranks, take median, map back to string.
 */
function medianOrdinalLevel(
  values: string[],
  rankMap: Record<string, number>,
  rankToLabel: Record<number, string>,
  fallback: string
): string {
  if (values.length === 0) return fallback;
  const ranks = values
    .map((v) => rankMap[v.toLowerCase()])
    .filter((r): r is number => typeof r === "number");
  if (ranks.length === 0) return fallback;
  const med = median(ranks);
  return rankToLabel[med] ?? fallback;
}

/**
 * Build group planning profile from all members' preferences for a trip.
 * Used by itinerary generation and Places API filters (budget, types, exclusions).
 */
export function generateGroupPlanningProfile(
  tripId: string
): GroupPlanningProfile | null {
  const trip = getTripById(tripId);
  if (!trip) return null;

  const prefs = getMemberPreferencesByTripId(tripId);
  if (prefs.length === 0) {
    return {
      tripId,
      destination: trip.destination,
      groupBudgetLevel: "moderate",
      commonActivityTypes: [],
      groupEnergyLevel: "medium",
      commonActiveHours: { start: "09:00", end: "21:00" },
      excludedTags: [],
      candidatePlaces: [],
    };
  }

  const budgetLevels = prefs
    .map((p) => p.budgetLevel)
    .filter((b): b is string => Boolean(b));
  const energyLevels = prefs
    .map((p) => p.energyLevel)
    .filter((e): e is string => Boolean(e));
  const activeHoursList = prefs
    .map((p) => p.activeHours)
    .filter((h): h is MemberPreference["activeHours"] => Boolean(h));
  const allActivityTypes = prefs.flatMap((p) => p.activityTypes ?? []);
  const uniqueActivityTypes = [...new Set(allActivityTypes)];
  const allDealBreakers = prefs.flatMap((p) => p.dealBreakers ?? []);
  const excludedTags = [...new Set(allDealBreakers)];
  const allPlaces = prefs.flatMap((p) => p.selectedPlaces ?? []);
  const candidatePlaces = [...new Set(allPlaces)];

  return {
    tripId,
    destination: trip.destination,
    groupBudgetLevel: medianOrdinalLevel(budgetLevels, BUDGET_RANK, BUDGET_BY_RANK, "moderate"),
    commonActivityTypes: uniqueActivityTypes,
    groupEnergyLevel: medianOrdinalLevel(energyLevels, ENERGY_RANK, ENERGY_BY_RANK, "medium"),
    commonActiveHours: overlappingActiveHours(activeHoursList),
    excludedTags,
    candidatePlaces,
  };
}
