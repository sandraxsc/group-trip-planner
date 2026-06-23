import { getTripMembers } from "../services/tripService";
import { getMemberPreferencesByTripId } from "../services/preferenceService";
import { getTripFlights } from "../services/flightService";
import { getTripHotels } from "../services/hotelService";
import { getGroupFlights, getGroupHotels } from "../services/groupLogisticsService";
import type { ItineraryGenerationContext } from "../types/itinerary";

/** Sync snapshot from local trip data (group logistics counts may be 0 until cloud hydrates). */
export function buildItineraryGenerationContextSync(
  tripId: string
): ItineraryGenerationContext {
  const members = getTripMembers(tripId);
  const memberPrefs = getMemberPreferencesByTripId(tripId);
  const prefMemberIds = new Set(memberPrefs.map((p) => p.memberId));
  const memberNames = members.filter((m) => prefMemberIds.has(m.id)).map((m) => m.name);
  const completedMembers = members.filter((m) => m.preferenceStatus === "completed").length;

  return {
    memberNames,
    totalMembers: members.length,
    completedMembers,
    groupFlightCount: 0,
    groupHotelCount: 0,
    personalFlightCount: getTripFlights(tripId).length,
    personalHotelCount: getTripHotels(tripId).length,
  };
}

/** Full snapshot including group logistics from Supabase. */
export async function captureItineraryGenerationContext(
  tripId: string
): Promise<ItineraryGenerationContext> {
  const base = buildItineraryGenerationContextSync(tripId);
  const [groupFlights, groupHotels] = await Promise.all([
    getGroupFlights(tripId),
    getGroupHotels(tripId),
  ]);
  return {
    ...base,
    groupFlightCount: groupFlights.length,
    groupHotelCount: groupHotels.length,
  };
}
