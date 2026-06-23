import type { Itinerary, TripPlan, TripPlanStatus } from "../types/itinerary";
import type { Trip } from "../types/trip";
import { getCachedActiveItinerary } from "./itineraryCloudStore";
import { isItineraryCommitted } from "../utils/itineraryCommit";

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

export function getPlanById(tripId: string, planId: string): TripPlan | null {
  return getTripPlans(tripId).find((p) => p.id === planId) ?? null;
}

/** All plans for a trip, newest first (includes selected and unselected). */
export function getAllTripPlans(tripId: string): TripPlan[] {
  return [...getTripPlans(tripId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Most recently generated plan that is not currently selected. */
export function getLatestPlan(tripId: string): TripPlan | null {
  const plans = getTripPlans(tripId).filter((p) => p.status === "candidate");
  if (plans.length === 0) return null;
  return [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function getSelectedPlan(tripId: string): TripPlan | null {
  return getTripPlans(tripId).find((p) => p.status === "selected") ?? null;
}

/** All non-selected plans (alternates tab). */
export function getAlternatePlans(tripId: string): TripPlan[] {
  return getTripPlans(tripId).filter((p) => p.status === "candidate");
}

/**
 * Persist a newly generated plan. Generation is saving — the plan is appended
 * immediately with status `candidate` and never replaces prior plans.
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
 * Mark `planId` as the group's selected plan. Any previously selected plan
 * for this trip reverts to `candidate` (never deleted).
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

/** Swap the active plan to another generated plan (same behavior as `selectPlan`). */
export function swapAlternatePlan(tripId: string, planId: string): TripPlan | null {
  return selectPlan(tripId, planId);
}

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
