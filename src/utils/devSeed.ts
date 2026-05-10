import { addTripMember, createTrip, getTripMembers, updateMemberPreferenceStatus } from "../services/tripService";
import { saveMemberPreference } from "../services/preferenceService";
import { saveMemberVotes } from "../services/voteService";

/**
 * Dev-only helper: seeds a complete 2-person trip so you can jump straight to plan generation.
 * - Creates a trip + 2 members
 * - Writes completed preferences for both
 * - Writes at least 1 vote per member so TripPlan auto-generation can start
 * - Sets sessionStorage currentTripId/currentMemberId for screens that depend on it
 */
export function seedQuickTripForTesting(args?: { destination?: string; tripDays?: number }): { tripId: string; memberIds: string[] } {
  const destination = args?.destination?.trim() || "Tokyo, Japan";
  const tripDays = args?.tripDays && args.tripDays > 0 ? args.tripDays : 3;

  const trip = createTrip(destination, "Tester 1", 2, tripDays);
  const m2 = addTripMember(trip.id, "Tester 2");
  const members = getTripMembers(trip.id);
  const owner = members.find((m) => m.role === "owner") ?? members[0];

  const common = {
    budgetLevel: "moderate" as const,
    energyLevel: "medium" as const,
    activeHours: { start: "09:00", end: "21:00" },
    activityTypes: ["culture", "food", "shopping", "nature"],
    selectedPlaces: [],
    dealBreakers: [],
  };

  for (const m of [owner, m2]) {
    if (!m) continue;
    saveMemberPreference(trip.id, m.id, common);
    updateMemberPreferenceStatus(m.id, "completed");
  }

  // Voting gate for TripPlan: membersCount === uniqueVoters. PlaceIds don't need to match candidates for this gate.
  const voteBundle = [
    { placeId: "seed-place-1", vote: "up" as const },
    { placeId: "seed-place-2", vote: "up" as const },
    { placeId: "seed-place-3", vote: "down" as const },
  ];
  if (owner) saveMemberVotes(trip.id, owner.id, voteBundle);
  saveMemberVotes(trip.id, m2.id, voteBundle);

  if (typeof window !== "undefined") {
    sessionStorage.setItem("currentTripId", trip.id);
    if (owner?.id) sessionStorage.setItem("currentMemberId", owner.id);
  }

  return { tripId: trip.id, memberIds: [owner?.id, m2.id].filter(Boolean) as string[] };
}

