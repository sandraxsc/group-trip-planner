import { getTripById, getTripMembers } from "./tripService";
import { getMemberPreferencesByTripId } from "./preferenceService";
import { mbtiToTravelSignals } from "../utils/mbtiUtils";
import type { GroupPlanningProfile } from "../types/preference";
import {
  flattenDealBreakerSelections,
  flattenMemberActivityTypes,
  type MemberPreference,
} from "../types/preference";

/**
 * GroupPlanningProfile derivation (see types/preference.ts for full rules):
 * - tripId, destination: From Trip.
 * - groupBudgetLevel: Median budgetLevel across members (ordinal rank → median → back to string).
 * - groupEnergyLevel: Median energyLevel across members (ordinal rank → median → back to string).
 * - commonActiveHours: Latest start, earliest end across members (overlapping window).
 * - commonActivityTypes: Union of all members' activityTypes.
 * - excludedTags: Flat union of all members' deal-breaker categories, tags, and notes.
 * - candidatePlaces: Union of all members' selectedPlaces.
 *
 * Used with Google Places API: groupBudgetLevel/COST_RANGE_BY_BUDGET, commonActivityTypes, excludedTags, candidatePlaces, commonActiveHours for scheduling.
 */

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
 * Convert "HH:mm" to minutes since midnight (for comparing windows).
 */
function timeToMinutesPlanning(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Common active hours: latest start and earliest end across members (intersection of same-day windows).
 * If no members have activeHours, returns default 09:00–21:00.
 * If members' windows do not overlap (e.g. 09–12 vs 18–21), start can end up after end; in that case
 * we fall back to defaults so scheduling / meal slots do not break (common with multi-guest trips).
 */
export function overlappingActiveHours(
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
  if (timeToMinutesPlanning(start) >= timeToMinutesPlanning(end)) {
    return { start: "09:00", end: "21:00" };
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

function hasMbtiAnswer(mbti: string | null | undefined): boolean {
  return typeof mbti === "string" && mbti.trim().length > 0;
}

function buildMemberPersonalities(
  members: MemberPreference[],
  nameByMemberId: Map<string, string>
): GroupPlanningProfile["memberPersonalities"] {
  return members.map((m) => ({
    memberId: m.memberId,
    name: nameByMemberId.get(m.memberId)?.trim() || "Member",
    signals: mbtiToTravelSignals(m.mbti ?? null),
  }));
}

function deriveMbtiGroupSignals(
  members: MemberPreference[]
): Pick<GroupPlanningProfile, "groupPlanningStyleVariance" | "groupSplitComfort"> {
  const withMbti = members.filter((m) => hasMbtiAnswer(m.mbti));
  if (withMbti.length < 2) {
    return { groupPlanningStyleVariance: null, groupSplitComfort: null };
  }

  const types = withMbti.map((m) => m.mbti!.trim().toUpperCase());
  const hasJ = types.some((t) => t.includes("J"));
  const hasP = types.some((t) => t.includes("P"));
  const groupPlanningStyleVariance: "low" | "high" = hasJ && hasP ? "high" : "low";

  const splittingCount = withMbti.filter(
    (m) => mbtiToTravelSignals(m.mbti ?? null).groupOrientation === "comfortable_splitting"
  ).length;
  const groupSplitComfort: "low" | "high" =
    splittingCount > withMbti.length / 2 ? "high" : "low";

  return { groupPlanningStyleVariance, groupSplitComfort };
}

const EMPTY_MBTI_GROUP_FIELDS: Pick<
  GroupPlanningProfile,
  "memberPersonalities" | "groupPlanningStyleVariance" | "groupSplitComfort"
> = {
  memberPersonalities: [],
  groupPlanningStyleVariance: null,
  groupSplitComfort: null,
};

/**
 * Build group planning profile from all members' preferences for a trip.
 * Used by itinerary generation and Places API filters (budget, types, exclusions).
 */
export function generateGroupPlanningProfile(
  tripId: string
): GroupPlanningProfile | null {
  const trip = getTripById(tripId);
  if (!trip) return null;

  const members = getMemberPreferencesByTripId(tripId);
  const nameByMemberId = new Map(
    getTripMembers(tripId).map((m) => [m.id, m.name] as const)
  );
  const memberPersonalities = buildMemberPersonalities(members, nameByMemberId);
  const mbtiGroupSignals = deriveMbtiGroupSignals(members);

  if (members.length === 0) {
    return {
      tripId,
      destination: trip.destination,
      groupBudgetLevel: "moderate",
      commonActivityTypes: [],
      groupEnergyLevel: "medium",
      commonActiveHours: { start: "09:00", end: "21:00" },
      excludedTags: [],
      candidatePlaces: [],
      ...EMPTY_MBTI_GROUP_FIELDS,
    };
  }

  const budgetLevels = members
    .map((p) => p.budgetLevel)
    .filter((b): b is string => Boolean(b));
  const energyLevels = members
    .map((p) => p.energyLevel)
    .filter((e): e is string => Boolean(e));
  const activeHoursList = members
    .map((p) => p.activeHours)
    .filter((h): h is MemberPreference["activeHours"] => Boolean(h));
  const allActivityTypes = members.flatMap((p) => flattenMemberActivityTypes(p));
  const uniqueActivityTypes = [...new Set(allActivityTypes)];
  const allDealBreakers = members.flatMap((p) =>
    flattenDealBreakerSelections(p.dealBreakers)
  );
  const excludedTags = [...new Set(allDealBreakers)];
  const allPlaces = members.flatMap((p) => p.selectedPlaces ?? []);
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
    memberPersonalities,
    ...mbtiGroupSignals,
  };
}
