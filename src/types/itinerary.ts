import type { CandidateActivity } from "./activity";
import type { SplitGroupPlanEvaluation } from "./splitGroupPlan";

/** Serialized transit leg (matches transitService.TransitInfo shape). */
export interface ItineraryTransitLeg {
  minutes: number;
  method: "walk" | "drive" | "transit";
  source: "api" | "heuristic";
}

/** Travel mode the AI decided for a leg, chosen during holistic day assignment. */
export type TravelModeFromPrevious = "driving" | "walking" | "transit" | null;

/** Cached leg timings between stops; avoids Routes API on every trip open when layout unchanged. */
export interface ItineraryTransitSnapshot {
  layoutFingerprint: string;
  /** Day index as string keys for JSON storage */
  transitByDay: Record<string, ItineraryTransitLeg[]>;
  adjustedStartByDay: Record<string, string[]>;
}

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
  /**
   * When set, only these member IDs attend this activity (split scheduling).
   * Absent means the whole group attends.
   */
  eligibleMembers?: string[];
  /**
   * AI-decided travel mode for the leg arriving at this activity from the
   * previous activity in the same day's AI-ordered activities array. Absent
   * or null when the AI didn't provide one (first activity of the day, meal
   * slots, split alternatives, or non-AI scheduling) — callers fall back to
   * distance-based inference in that case.
   */
  travelModeFromPrevious?: TravelModeFromPrevious;
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

/**
 * Optional flight-driven clamp on a day's available window. When present
 * the UI can render an inline explainer (e.g. "Day starts at 2:30 PM after
 * all guests arrive") so the schedule shift doesn't look arbitrary.
 */
export interface FlightDayClamp {
  reason: "arrival" | "departure";
  /** "HH:mm" — the wall-clock boundary the day was clamped against. */
  time: string;
  /** Trip-member ids whose flight produced this constraint. */
  memberIds: string[];
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
  /** AI: vivid one-sentence vibe for the day (trip plan header). */
  dayTheme?: string;
  /** AI: planning rationale for this group (not a play-by-play of stops). */
  dayReasoning?: string;
  /** PlaceIds the AI suggested as same-day fallbacks if a venue is unavailable. */
  fallbacks?: string[];
  /** Scheduler note: closure moved, intensity reduced, or timeSensitive miss. */
  dayNote?: string;
  /**
   * Set when this day's window was tightened by an inbound flight (Day 1)
   * or outbound flight (final day). Activities outside the clamp are
   * dropped by `generateItinerary` so the timeline stays realistic.
   */
  flightClamp?: FlightDayClamp;
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
  /**
   * Resolved Google Places coordinates for this row, persisted alongside
   * `placeId` so the transit pipeline can compute real walking / driving
   * legs instead of falling back to the 10-min heuristic.
   *
   * Set when the user picks a place from autocomplete and we successfully
   * fetch place details. Optional — rows that were created before this
   * field existed, or pending rows that haven't been picked yet, simply
   * omit it and the UI gracefully falls back.
   */
  location?: { lat: number; lng: number };
}

/** Full itinerary for a trip. */
export interface Itinerary {
  tripId: string;
  days: ItineraryDay[];
  /** When this itinerary was last saved for the trip (ISO timestamp). */
  savedAt?: string;
  /** Optional last updated time if itinerary is overwritten. */
  updatedAt?: string;
  /**
   * Optional user-edited row order per day (hotel slots + activities).
   * When set, `itineraryToDisplayDays` builds the timeline from this order.
   */
  editRowsByDay?: Record<string, ItineraryEditRow[]>;
  /**
   * When present and `layoutFingerprint` matches the current trip-detail layout,
   * the UI can skip recomputing inter-stop transit (Routes / heuristics).
   */
  transitSnapshot?: ItineraryTransitSnapshot;
  /** Set during generation when profile conflicts warrant evaluating split-group time (see `evaluateSplitGroupPlan`). */
  splitPlan?: SplitGroupPlanEvaluation;
  /**
   * Snapshot of member preferences and logistics at plan generation time.
   * Used to label version history (what inputs this plan was built from).
   */
  generationContext?: ItineraryGenerationContext;
  /**
   * When false, the active plan is a generated preview until the user taps Save
   * on the plan screen. Unsaved drafts are replaced (not archived) on regen.
   */
  isCommitted?: boolean;
}

/** `candidate` = saved but not active; `selected` = saved, active, editable. */
export type TripPlanStatus = "candidate" | "selected";

export interface TripPlan {
  id: string;
  tripId: string;
  itinerary: Itinerary;
  status: TripPlanStatus;
  regenerationsUsed: number;
  createdAt: string;
}

/** Captured when a plan version is saved — drives human-readable version labels. */
export interface ItineraryGenerationContext {
  /** Members who had saved preference data when this plan was generated. */
  memberNames: string[];
  totalMembers: number;
  completedMembers: number;
  groupFlightCount: number;
  groupHotelCount: number;
  personalFlightCount: number;
  personalHotelCount: number;
}

export interface HolisticDayAssignmentInput {
  tripId: string;
  tripDays: number;
  destination: string;
  /**
   * YYYY-MM-DD start date of the trip. When present the scheduler can derive
   * the real weekday for each dayIndex and cross-check closedDays.
   */
  tripStartDate?: string;
  /**
   * Weekday name (e.g. "Monday") for each 1-based dayIndex.
   * Index 0 unused; dayWeekdays[1] = weekday of Day 1, etc.
   * Only populated when tripStartDate is known.
   */
  dayWeekdays?: string[];
  groupProfile: {
    energyLevel: string;
    activeHours: { start: string; end: string };
    budgetLevel: string;
    planningStyleVariance: "low" | "high" | null;
    splitComfort: "low" | "high" | null;
  };
  memberPersonalities: {
    memberId: string;
    name: string;
    signals: import("../utils/mbtiUtils").MBTITravelSignals;
    budgetLevel: string;
    dealBreakers: string[];
  }[];
  maxPerDayByDayIndex: number[];
  nonFoodCandidates: {
    placeId: string;
    name: string;
    category: string;
    intensity: string | null;
    durationMinutes: number;
    location: { lat: number; lng: number } | null;
    voteScore: number;
    closedDays?: string;
    /** Pre-computed dayIndex values where venue is open (derived from closedDays + trip start). */
    eligibleDays?: number[];
    timeSensitive?: boolean;
    splitCandidate?: boolean;
    splitReason?: string | null;
    budgetTier?: string;
    fallbackOption?: { placeId?: string; name: string; closedDays: string };
    eligibleMembers?: string[];
  }[];
  foodCandidates: {
    placeId: string;
    name: string;
    category: string;
    location: { lat: number; lng: number } | null;
    /** 0–4 Google Places price level; used by scheduler to avoid over-budget restaurants. */
    priceLevel?: number;
  }[];
  validationErrors: {
    dayIndex: number;
    type: "unknown_placeId" | "wrong_category" | "duplicate";
    placeId: string;
  }[];
}

export interface HolisticDayAssignmentResult {
  days: {
    dayIndex: number;
    activities: { placeId: string; travelModeFromPrevious: TravelModeFromPrevious }[];
    lunch: string | null;
    dinner: string | null;
    fallbacks?: string[];
    dayNote?: string;
    splitActivity?: {
      main: { placeId: string; members: string[] };
      alternative: { placeId: string; members: string[] };
    };
  }[];
}
