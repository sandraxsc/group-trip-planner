import { addTripMember, createTrip, getTripMembers, updateMemberPreferenceStatus } from "../services/tripService";
import { saveMemberPreference } from "../services/preferenceService";
import { saveMemberVotes } from "../services/voteService";
import type { BudgetLevel, EnergyLevel, MemberPreference } from "../types/preference";

/**
 * placeId used by vote candidates for user-selected strings (see buildUserSelectedActivities).
 * Votes must use this id or aggregation never sees up/down counts.
 */
export function userSelectedCandidatePlaceId(nameOrId: string): string {
  return `user-${nameOrId.replace(/\s+/g, "-")}`;
}

function seedVote(placeId: string, vote: "up" | "down"): { placeId: string; vote: "up" | "down" } {
  return { placeId: userSelectedCandidatePlaceId(placeId), vote };
}

/** Shared venue ids for prefs selectedPlaces (Tokyo edge-case scenario). */
export const EDGE_CASE_SEED_PLACES = {
  michelinSushi: "seed-tokyo-sukiyabashi-jiro",
  privateHotel: "seed-tokyo-aman-tokyo",
  chauffeurTour: "seed-tokyo-luxury-limo-tour",
  hostelDistrict: "seed-tokyo-khaosan-asakusa-hostel",
  conbiniTrail: "seed-tokyo-lawson-conbini-crawl",
  freeTempleWalk: "seed-tokyo-sensoji-free-walk",
  akihabaraAnime: "seed-tokyo-akihabara-anime-district",
  shibuyaNightlife: "seed-tokyo-shibuya-nightlife",
  nakanoBroadway: "seed-tokyo-nakano-broadway",
} as const;

type SeedMemberSpec = {
  name: string;
  preference: Partial<Omit<MemberPreference, "memberId" | "tripId">>;
  votes: { placeId: string; vote: "up" | "down" }[];
};

const EDGE_CASE_MEMBERS: SeedMemberSpec[] = [
  {
    name: "Traveler A",
    preference: {
      budgetLevel: "luxury" as BudgetLevel,
      energyLevel: "medium" as EnergyLevel,
      activeHours: { start: "10:00", end: "22:00" },
      activityTypes: ["food", "spa", "culture", "photography"],
      selectedPlaces: [
        EDGE_CASE_SEED_PLACES.michelinSushi,
        EDGE_CASE_SEED_PLACES.privateHotel,
        EDGE_CASE_SEED_PLACES.chauffeurTour,
      ],
      dealBreakers: ["crowded"],
      mbti: "ENTJ",
    },
    votes: [
      seedVote(EDGE_CASE_SEED_PLACES.michelinSushi, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.privateHotel, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.chauffeurTour, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.hostelDistrict, "down"),
      seedVote(EDGE_CASE_SEED_PLACES.conbiniTrail, "down"),
      seedVote(EDGE_CASE_SEED_PLACES.akihabaraAnime, "down"),
      seedVote(EDGE_CASE_SEED_PLACES.shibuyaNightlife, "down"),
    ],
  },
  {
    name: "Traveler B",
    preference: {
      budgetLevel: "budget" as BudgetLevel,
      energyLevel: "low" as EnergyLevel,
      activeHours: { start: "07:00", end: "20:00" },
      activityTypes: ["food", "culture", "history"],
      selectedPlaces: [
        EDGE_CASE_SEED_PLACES.hostelDistrict,
        EDGE_CASE_SEED_PLACES.conbiniTrail,
        EDGE_CASE_SEED_PLACES.freeTempleWalk,
      ],
      dealBreakers: ["long-travel"],
      mbti: "ISTJ",
    },
    votes: [
      seedVote(EDGE_CASE_SEED_PLACES.hostelDistrict, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.conbiniTrail, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.freeTempleWalk, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.michelinSushi, "down"),
      seedVote(EDGE_CASE_SEED_PLACES.privateHotel, "down"),
      seedVote(EDGE_CASE_SEED_PLACES.chauffeurTour, "down"),
      seedVote(EDGE_CASE_SEED_PLACES.shibuyaNightlife, "down"),
    ],
  },
  {
    name: "Traveler C",
    preference: {
      budgetLevel: "moderate" as BudgetLevel,
      energyLevel: "high" as EnergyLevel,
      activeHours: { start: "14:00", end: "23:00" },
      activityTypes: ["shopping", "nightlife", "culture", "food"],
      selectedPlaces: [
        EDGE_CASE_SEED_PLACES.akihabaraAnime,
        EDGE_CASE_SEED_PLACES.shibuyaNightlife,
        EDGE_CASE_SEED_PLACES.nakanoBroadway,
      ],
      dealBreakers: [],
      mbti: "ENFP",
    },
    votes: [
      seedVote(EDGE_CASE_SEED_PLACES.akihabaraAnime, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.shibuyaNightlife, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.nakanoBroadway, "up"),
      seedVote(EDGE_CASE_SEED_PLACES.michelinSushi, "down"),
      seedVote(EDGE_CASE_SEED_PLACES.hostelDistrict, "down"),
      seedVote(EDGE_CASE_SEED_PLACES.chauffeurTour, "down"),
    ],
  },
];

function applySession(tripId: string, ownerId: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("currentTripId", tripId);
    sessionStorage.setItem("currentMemberId", ownerId);
  }
}

/**
 * Dev-only: 3-person Tokyo trip with conflicting luxury / budget / nightlife priorities,
 * full preferences (places + MBTI), and opposing votes to stress split-group planning.
 */
export function seedEdgeCaseThreePersonTrip(args?: {
  destination?: string;
  tripDays?: number;
}): { tripId: string; memberIds: string[] } {
  const destination = args?.destination?.trim() || "Tokyo, Japan";
  const tripDays = args?.tripDays && args.tripDays > 0 ? args.tripDays : 4;

  const trip = createTrip(destination, EDGE_CASE_MEMBERS[0]!.name, 3, tripDays);
  const m2 = addTripMember(trip.id, EDGE_CASE_MEMBERS[1]!.name);
  const m3 = addTripMember(trip.id, EDGE_CASE_MEMBERS[2]!.name);

  const members = getTripMembers(trip.id);
  const byName = new Map(members.map((m) => [m.name, m]));
  const owner = byName.get(EDGE_CASE_MEMBERS[0]!.name) ?? members.find((m) => m.role === "owner");

  const specs: { member: (typeof members)[0]; spec: SeedMemberSpec }[] = [];
  for (const spec of EDGE_CASE_MEMBERS) {
    const member =
      spec.name === EDGE_CASE_MEMBERS[0]!.name
        ? owner
        : spec.name === EDGE_CASE_MEMBERS[1]!.name
          ? m2
          : m3;
    if (member) specs.push({ member, spec });
  }

  for (const { member, spec } of specs) {
    saveMemberPreference(trip.id, member.id, spec.preference);
    updateMemberPreferenceStatus(member.id, "completed");
    saveMemberVotes(trip.id, member.id, spec.votes);
  }

  const memberIds = specs.map((s) => s.member.id);
  if (owner?.id) applySession(trip.id, owner.id);

  return { tripId: trip.id, memberIds };
}

/** @deprecated Use seedEdgeCaseThreePersonTrip — kept as alias for older dev buttons. */
export function seedQuickTripForTesting(args?: { destination?: string; tripDays?: number }) {
  return seedEdgeCaseThreePersonTrip(args);
}
