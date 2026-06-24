import type { TripPlan } from "../../types/itinerary";

/**
 * A `TripPlan` augmented with a stable, human-readable plan number.
 *
 * `planNumber` is assigned by creation order (oldest plan = 1) so the label
 * never changes even after newer plans are generated or a plan is selected.
 */
export type PlanListItem = TripPlan & { planNumber: number };

/**
 * Prepares a flat plan array for display in the plan list screen.
 *
 * Plan numbers are computed by creation order so they are stable across
 * regenerations and plan selection changes: Plan 1 is always the first plan
 * ever generated for the trip, regardless of which plan is currently selected.
 * The returned array is sorted newest-first so the most recent plan appears at
 * the top of the list.
 *
 * @param plans - Raw plans from `getAllTripPlans()` in any order.
 * @returns Plans sorted newest-first with a `planNumber` field attached.
 *
 * @example
 * ```ts
 * const items = buildPlanListItems(getAllTripPlans(tripId));
 * // items[0] is the newest plan; items[0].planNumber may be 3 if it's the 3rd generated
 * ```
 */
export function buildPlanListItems(plans: TripPlan[]): PlanListItem[] {
  const byAge = [...plans].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const numberById = new Map(byAge.map((plan, index) => [plan.id, index + 1]));
  return [...plans]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((plan) => ({
      ...plan,
      planNumber: numberById.get(plan.id) ?? 1,
    }));
}
