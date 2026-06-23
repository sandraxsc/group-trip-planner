import type { Trip, TripMember } from "../types/trip";
import { MAX_TRIP_MEMBERS } from "../services/tripService";
import { hasCachedActiveItinerary, getCachedActiveItinerary } from "../services/itineraryCloudStore";
import { isItineraryCommitted } from "./itineraryCommit";

const PLANNING_STEP_COUNT = 4;

/**
 * V2 planning progress: Invite → Preferences → Generate → Select (4 steps).
 * Logistics and voting are not required steps.
 */
export function getTripPlanningProgressPercent(trip: Trip, members: TripMember[]): number {
  const capacity = trip.maxGuests && trip.maxGuests > 0 ? trip.maxGuests : MAX_TRIP_MEMBERS;
  const inviteStepComplete = members.length >= capacity;
  const allPreferencesComplete =
    members.length > 0 && members.every((m) => m.preferenceStatus === "completed");
  const hasGeneratedPlans =
    hasCachedActiveItinerary(trip.id) || (trip.plans?.length ?? 0) > 0;
  const generateStepComplete = hasGeneratedPlans && !trip.isOutdated;
  const savedItinerary = getCachedActiveItinerary(trip.id);
  const hasCommittedItinerary = isItineraryCommitted(savedItinerary);

  const completedCount =
    (inviteStepComplete ? 1 : 0) +
    (allPreferencesComplete ? 1 : 0) +
    (generateStepComplete ? 1 : 0) +
    (hasCommittedItinerary ? 1 : 0);

  return Math.round((completedCount / PLANNING_STEP_COUNT) * 100);
}
