/**
 * Plan persistence layer for the multi-plan itinerary feature.
 *
 * ## Storage strategy
 * Plans are written to two locations so that legacy code reading the old flat
 * `tripPlans` key keeps working while new code uses the canonical
 * `trip.plans` array inside the `trips` key:
 * - **Canonical:** `localStorage["trips"][i].plans` (array on the trip object)
 * - **Legacy mirror:** `localStorage["tripPlans"]` (flat array, all trips)
 *
 * ## Status lifecycle
 * ```
 * savePlan()  →  status: "candidate"
 * selectPlan() →  target: "selected", prior selected: "candidate"
 * ```
 * Plans are never deleted — selecting a new plan demotes the old one.
 */
import type { Itinerary, TripPlan, TripPlanStatus } from "../types/itinerary";
import type { Trip } from "../types/trip";
import {
  commitActiveItinerary,
  getCachedActiveItinerary,
  updateActiveItineraryPayload,
} from "./itineraryCloudStore";
import { isItineraryCommitted } from "../utils/itineraryCommit";
import { updateTrip } from "./tripService";

/** Lifetime cap on plan regenerations per trip (mirrors itinerary regen cap). */
export const MAX_REGENERATIONS = 5;

/** Legacy flat store — kept for backward compat; `trip.plans` is canonical. */
const LEGACY_STORAGE_KEY = "tripPlans";
const TRIPS_STORAGE_KEY = "trips";

function getLegacyPlansStorage(): TripPlan[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TripPlan[]) : [];
  } catch {
    return [];
  }
}

function setLegacyPlansStorage(plans: TripPlan[]): void {
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(plans));
}

function getTripsStorage(): Trip[] {
  try {
    const raw = localStorage.getItem(TRIPS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Trip[]) : [];
  } catch {
    return [];
  }
}

function setTripsStorage(trips: Trip[]): void {
  localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
}

function generatePlanId(): string {
  return crypto.randomUUID?.() ?? `tp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Map legacy statuses onto the simplified model. */
function normalizePlanStatus(status: string): TripPlanStatus {
  if (status === "selected") return "selected";
  return "candidate";
}

function normalizePlan(plan: TripPlan): TripPlan {
  return { ...plan, status: normalizePlanStatus(plan.status) };
}

function persistTripPlans(tripId: string, plans: TripPlan[]): void {
  const trips = getTripsStorage();
  const idx = trips.findIndex((t) => t.id === tripId);
  if (idx === -1) return;
  trips[idx] = { ...trips[idx], plans };
  setTripsStorage(trips);

  const legacy = getLegacyPlansStorage().filter((p) => p.tripId !== tripId);
  setLegacyPlansStorage([...legacy, ...plans]);
}

function loadTripPlans(tripId: string): TripPlan[] {
  const trip = getTripsStorage().find((t) => t.id === tripId);
  if (trip?.plans && trip.plans.length > 0) {
    return trip.plans.map(normalizePlan);
  }

  const legacy = getLegacyPlansStorage()
    .filter((p) => p.tripId === tripId)
    .map(normalizePlan);

  if (legacy.length > 0) {
    persistTripPlans(tripId, legacy);
  }

  return legacy;
}

/**
 * Returns all plans for a trip, triggering a one-time backfill if the trip has
 * an active itinerary but no plan rows yet (legacy trips predating this module).
 *
 * @param tripId - The trip whose plans to load.
 * @returns All plans in storage order (not sorted).
 */
export function getTripPlans(tripId: string): TripPlan[] {
  syncMissingPlansFromActiveItinerary(tripId);
  return loadTripPlans(tripId);
}

/**
 * Backfill `trip.plans` when an active itinerary exists but no plan rows were
 * persisted (legacy flows that only called upsertActiveItineraryDraft).
 */
export function syncMissingPlansFromActiveItinerary(tripId: string): void {
  if (loadTripPlans(tripId).length > 0) return;
  const itinerary = getCachedActiveItinerary(tripId);
  if (!itinerary?.days?.length) return;

  const trip = getTripsStorage().find((t) => t.id === tripId);
  const plan: TripPlan = {
    id: generatePlanId(),
    tripId,
    itinerary: { ...itinerary, tripId },
    status: isItineraryCommitted(itinerary) ? "selected" : "candidate",
    regenerationsUsed: trip?.regenCount ?? 0,
    createdAt: new Date().toISOString(),
  };
  persistTripPlans(tripId, [plan]);
}

/**
 * Looks up a single plan by its ID within a trip.
 *
 * @param tripId - The trip that owns the plan.
 * @param planId - The plan's unique ID.
 * @returns The matching `TripPlan`, or `null` if not found.
 */
export function getPlanById(tripId: string, planId: string): TripPlan | null {
  return getTripPlans(tripId).find((p) => p.id === planId) ?? null;
}

/**
 * Returns all plans for a trip sorted newest-first.
 * Includes both `selected` and `candidate` plans — never filters.
 *
 * @param tripId - The trip whose plans to fetch.
 */
export function getAllTripPlans(tripId: string): TripPlan[] {
  return [...getTripPlans(tripId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Returns the most recently generated plan that is not yet selected.
 * Used after generation to navigate directly to the new plan.
 *
 * @param tripId - The trip to search.
 * @returns The newest candidate plan, or `null` if all plans are selected or none exist.
 */
export function getLatestPlan(tripId: string): TripPlan | null {
  const plans = getTripPlans(tripId).filter((p) => p.status === "candidate");
  if (plans.length === 0) return null;
  return [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/**
 * Returns the group's currently active plan, or `null` if none has been selected yet.
 *
 * @param tripId - The trip to search.
 */
export function getSelectedPlan(tripId: string): TripPlan | null {
  return getTripPlans(tripId).find((p) => p.status === "selected") ?? null;
}

/**
 * Returns all non-selected (candidate) plans for a trip.
 * These are shown in the Alternates tab so the group can switch plans.
 *
 * @param tripId - The trip to search.
 */
export function getAlternatePlans(tripId: string): TripPlan[] {
  return getTripPlans(tripId).filter((p) => p.status === "candidate");
}

/**
 * Persists a newly generated itinerary as a `candidate` plan.
 *
 * Each generation appends a new plan row rather than replacing the previous one,
 * so the group always retains every generated version for comparison.
 *
 * @param tripId - The trip to attach the plan to.
 * @param itinerary - The generated itinerary payload.
 * @param regenerationsUsed - Snapshot of the trip's regen counter at generation time.
 * @returns The newly created `TripPlan` with `status: "candidate"`.
 */
export function savePlan(
  tripId: string,
  itinerary: Itinerary,
  regenerationsUsed = 0
): TripPlan {
  const existing = loadTripPlans(tripId);

  const plan: TripPlan = {
    id: generatePlanId(),
    tripId,
    itinerary: { ...itinerary, tripId },
    status: "candidate",
    regenerationsUsed,
    createdAt: new Date().toISOString(),
  };

  persistTripPlans(tripId, [...existing, plan]);
  return plan;
}

/**
 * Marks `planId` as the group's active plan and demotes any previously selected
 * plan back to `candidate`. Plans are never deleted during a swap.
 *
 * Selecting a plan also signals that the trip is ready to move into the
 * `executing` phase — callers are responsible for updating `trip.tripStatus`.
 *
 * @param tripId - The trip that owns the plan.
 * @param planId - The plan to activate.
 * @returns The updated `TripPlan` with `status: "selected"`, or `null` if the
 *   plan ID was not found.
 */
export function selectPlan(tripId: string, planId: string): TripPlan | null {
  const existing = loadTripPlans(tripId);
  const target = existing.find((p) => p.id === planId);
  if (!target) return null;

  const updated = existing.map((p) => {
    if (p.id === planId) return { ...p, status: "selected" as const };
    if (p.status === "selected") return { ...p, status: "candidate" as const };
    return p;
  });

  persistTripPlans(tripId, updated);
  return updated.find((p) => p.id === planId) ?? null;
}

/**
 * Swaps the active plan to a previously generated alternate.
 * Alias for {@link selectPlan} — kept for call-site readability in the Alternates tab.
 *
 * @param tripId - The trip that owns the plans.
 * @param planId - The alternate plan to activate.
 */
export function swapAlternatePlan(tripId: string, planId: string): TripPlan | null {
  return selectPlan(tripId, planId);
}

/**
 * Selects `planId` and immediately commits it as the trip's active itinerary,
 * moving the trip into the `executing` phase. Combines {@link selectPlan} with
 * the persist/commit/tripStatus steps every call site otherwise had to repeat
 * by hand (previously duplicated in TripPlanDetailView and TripDetailScreen).
 *
 * Used both right after a plan is generated (no separate "select" step) and
 * when regenerating an already-executing trip's plan in place.
 */
export async function selectAndCommitPlan(
  tripId: string,
  planId: string
): Promise<{ ok: true; plan: TripPlan } | { ok: false; message: string }> {
  const selected = selectPlan(tripId, planId);
  if (!selected) {
    return { ok: false, message: "That plan could not be found." };
  }

  await updateActiveItineraryPayload(tripId, selected.itinerary);
  const result = await commitActiveItinerary(tripId, selected.itinerary);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  updateTrip(tripId, { tripStatus: "executing" });
  return { ok: true, plan: selected };
}

/**
 * Removes all plan rows for a trip from both storage locations.
 * Intended for trip deletion flows — not for plan regeneration or swapping.
 *
 * @param tripId - The trip whose plans should be erased.
 */
export function deleteTripPlans(tripId: string): void {
  const trips = getTripsStorage();
  const idx = trips.findIndex((t) => t.id === tripId);
  if (idx !== -1) {
    const { plans: _removed, ...rest } = trips[idx];
    trips[idx] = rest as Trip;
    setTripsStorage(trips);
  }
  setLegacyPlansStorage(getLegacyPlansStorage().filter((p) => p.tripId !== tripId));
}
