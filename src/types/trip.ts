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
