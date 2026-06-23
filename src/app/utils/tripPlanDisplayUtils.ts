import { generateGroupPlanningProfile, COST_RANGE_BY_BUDGET } from "../../services/planningService";
import { getTripMembers } from "../../services/tripService";
import type { Itinerary } from "../../types/itinerary";
import type { TripMember } from "../../types/trip";

export function estimatePerPerson(tripId: string, dayCount: number): string {
  try {
    const profile = generateGroupPlanningProfile(tripId);
    if (!profile) return "$—";
    const budget = (profile.groupBudgetLevel || "moderate").toLowerCase();
    const range = COST_RANGE_BY_BUDGET[budget] ?? COST_RANGE_BY_BUDGET.moderate;
    const perDay =
      range.minPerDay && range.maxPerDay
        ? (range.minPerDay + range.maxPerDay) / 2
        : range.maxPerDay ?? range.minPerDay ?? 100;
    const total = perDay * Math.max(1, dayCount);
    const rounded = Math.round(total / 10) * 10;
    return `$${rounded}`;
  } catch {
    return "$—";
  }
}

export function loadTripPlanDisplayMeta(
  tripId: string,
  itinerary: Itinerary
): { tripDaysCount: number; estPerPerson: string; members: TripMember[]; membersCount: number } {
  const tripDaysCount = Math.max(1, itinerary.days?.length ?? 1);
  const members = getTripMembers(tripId);
  return {
    tripDaysCount,
    estPerPerson: estimatePerPerson(tripId, tripDaysCount),
    members,
    membersCount: members.length,
  };
}
