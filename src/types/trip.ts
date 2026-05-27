/**
 * What kind of social group is taking this trip. Set once by the trip leader
 * at creation time and threaded into the AI itinerary scheduler so prompts
 * can tailor pacing, recommended activities, and copy to the group's vibe
 * (e.g. avoid late-night clubs for a "family" trip with kids; lean into
 * romantic dinners for a "couple"; suggest icebreakers for a "meetup").
 */
export type GroupType =
  | "colleagues" // Team building / work trip
  | "family" // Family trip (may include children)
  | "couple" // Romantic / partner trip
  | "close_friends" // Best friends who know each other well
  | "meetup" // Strangers / community meetup
  | "new_friends"; // Friends who are not yet close

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
  /**
   * Social context for the trip — passed downstream into the AI scheduler.
   * Optional for backwards-compat with trips saved before this field existed;
   * consumers must treat `undefined` as "unknown" rather than picking a default.
   */
  groupType?: GroupType;
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

/**
 * One member's flight into or out of the trip destination. Per-member, not
 * shared like hotels: each guest adds their own flight(s) on the Logistics
 * tab so the planner can use real arrival/departure times when scheduling
 * Day 1 (after everyone has landed) and the final day (before anyone has
 * to leave).
 *
 * Each member can have at most one flight in each direction. Direction is
 * the discriminator: `(memberId, direction)` is the unique key.
 */
export interface TripFlight {
  id: string;
  tripId: string;
  memberId: string;
  /**
   * "arrival" = inbound to the trip destination on (or before) Day 1.
   * "departure" = outbound from the trip destination on (or after) the last day.
   * Defaults to "arrival" when the field is missing on legacy rows.
   */
  direction: "arrival" | "departure";
  /** IATA airport code, e.g. "DCA". */
  origin: string;
  /** IATA airport code, e.g. "CDG". */
  destination: string;
  /** ISO date string for the day of travel (YYYY-MM-DD or full ISO). */
  date: string;
  airline: string;
  flightNumber?: string;
  durationMinutes?: number;
  /**
   * Local clock time at the relevant trip-destination airport, "HH:MM" 24h.
   * For arrivals this is the landing time; for departures it's the takeoff
   * time. The label in the UI switches based on `direction`.
   */
  arrivalTime?: string;
}
