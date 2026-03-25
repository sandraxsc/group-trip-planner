import type { CandidateActivity } from "./activity";

/** One member's vote on an activity (up = like, down = dislike). */
export interface ActivityVote {
  tripId: string;
  memberId: string;
  placeId: string;
  vote: "up" | "down";
}

/** Time block label for scheduling (morning / afternoon / evening). */
export type TimeBlockLabel = "morning" | "afternoon" | "evening";

/** A scheduled activity in the itinerary (activity + assigned time). */
export interface ScheduledActivity {
  placeId: string;
  name: string;
  /** Start time "HH:mm" */
  startTime: string;
  /** End time "HH:mm" */
  endTime: string;
  /** Duration in minutes */
  durationMinutes: number;
  /** Block this was placed in (morning/afternoon/evening or lunch/dinner) */
  blockLabel: TimeBlockLabel | "lunch" | "dinner";
  /** Underlying activity data for display */
  activity: CandidateActivity;
}

/** Meal slot (lunch or dinner) with optional scheduled food activity. */
export interface MealBlock {
  label: "lunch" | "dinner";
  /** Slot start "HH:mm" */
  startTime: string;
  /** Slot end "HH:mm" (start + 60 min) */
  endTime: string;
  /** If a food activity was assigned */
  activity?: ScheduledActivity;
}

/** One activity block (morning/afternoon/evening) with scheduled non-meal activities. */
export interface ItineraryBlock {
  label: TimeBlockLabel;
  startTime: string;
  endTime: string;
  activities: ScheduledActivity[];
}

/** One day in the generated itinerary. */
export interface ItineraryDay {
  dayIndex: number;
  /** Day start "HH:mm" from commonActivityHours */
  startTime: string;
  /** Day end "HH:mm" */
  endTime: string;
  blocks: ItineraryBlock[];
  lunchSlot: MealBlock;
  dinnerSlot: MealBlock;
  energyLevel: "low" | "medium" | "high";
  maxNonMealActivities: number;
}

/**
 * One row in the trip-detail itinerary editor (drag order, hotels, activities).
 * Persisted on `Itinerary.editRowsByDay` (string dayIndex keys).
 */
export interface ItineraryEditRow {
  id: string;
  kind: "hotel" | "activity";
  placeId?: string;
  mealSlot?: "lunch" | "dinner";
  /** User label for hotel rows (e.g. hotel name). */
  hotelLabel?: string;
  /** User label for activity rows when a real itinerary item isn't available yet. */
  activityLabel?: string;
  /** Synthetic activity row not yet tied to a place. */
  isPlaceholder?: boolean;
}

/** Full itinerary for a trip. */
export interface Itinerary {
  tripId: string;
  days: ItineraryDay[];
  /** Ordered list of activity placeIds that were used (after vote re-rank and bottom-5 removal) */
  activityOrder: string[];
  /** When this itinerary was last saved for the trip (ISO timestamp). */
  savedAt?: string;
  /** Optional last updated time if itinerary is overwritten. */
  updatedAt?: string;
  /**
   * Optional user-edited row order per day (hotel slots + activities).
   * When set, `itineraryToDisplayDays` builds the timeline from this order.
   */
  editRowsByDay?: Record<string, ItineraryEditRow[]>;
}
