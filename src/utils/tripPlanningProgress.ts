import type { Trip, TripMember } from "../types/trip";
import { MAX_TRIP_MEMBERS } from "../services/tripService";
import { getItinerary } from "../services/itineraryService";

/**
 * Matches TripDetailScreen "PLANNING STEPS" completion: invite full, all prefs done,
 * vote step is never marked completed in that UI, itinerary generated.
 */
export function getTripPlanningProgressPercent(trip: Trip, members: TripMember[]): number {
  const capacity = trip.maxGuests && trip.maxGuests > 0 ? trip.maxGuests : MAX_TRIP_MEMBERS;
  const inviteStepComplete = members.length >= capacity;
  const allPreferencesComplete =
    members.length > 0 && members.every((m) => m.preferenceStatus === "completed");
  const voteStepComplete = false;
  const hasSavedItinerary = !!getItinerary(trip.id);

  const completedCount =
    (inviteStepComplete ? 1 : 0) +
    (allPreferencesComplete ? 1 : 0) +
    (voteStepComplete ? 1 : 0) +
    (hasSavedItinerary ? 1 : 0);

  return Math.round((completedCount / 4) * 100);
}
