export interface Trip {
  id: string;
  name: string;
  destination: string;
  /** Number of days for the trip; used for vote candidate limit (tripDays * maxDailyActivities). */
  tripDays?: number;
  /** Expected maximum number of guests (including owner). Used for invite capacity. */
  maxGuests?: number;
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
