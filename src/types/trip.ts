export interface Trip {
  id: string;
  name: string;
  destination: string;
  /** Number of days for the trip; used for vote candidate limit (tripDays * maxDailyActivities). */
  tripDays?: number;
  /** Expected maximum number of guests (including owner). Used for invite capacity. */
  maxGuests?: number;
  /**
   * Trip start date as YYYY-MM-DD (local). Used to map dayIndex (1-based) to a real
   * weekday for opening-hour validation. Optional for legacy trips created before this
   * field existed; consumers must fall back to dayIndex-only logic when missing.
   */
  startDate?: string;
  createdAt: string;
}

export interface TripInvite {
  tripId: string;
  token: string;
  joinUrl: string;
  createdAt: string;
  isActive: boolean;
}

/** Grey = not started, Yellow = in progress, Green = completed */
export type PreferenceStatus = "not_started" | "in_progress" | "completed";

export interface TripMember {
  id: string;
  tripId: string;
  name: string;
  joinedAt: string;
  role: "owner" | "member";
  /** Preference setting status for status dot UI */
  preferenceStatus: PreferenceStatus;
}

/**
 * One hotel a group will stay at during the trip, with the inclusive day
 * range it covers (1-based, matches Itinerary dayIndex). Shared across all
 * trip guests. Optional: a trip may have zero hotels, and gaps between
 * day-ranges are allowed. Overlaps are not allowed (validated client-side).
 */
export interface TripHotel {
  id: string;
  tripId: string;
  /** Google placeId when picked from autocomplete; "" if free-text only. */
  placeId: string;
  /** Hotel display name (e.g. "Park Hyatt Tokyo"). */
  name: string;
  /** Optional formatted address from Places. */
  address?: string;
  /** 1-based inclusive starting day index. */
  dayStart: number;
  /** 1-based inclusive ending day index (>= dayStart). */
  dayEnd: number;
  createdAt: string;
}
