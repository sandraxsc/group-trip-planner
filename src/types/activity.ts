/**
 * Structured candidate activity for voting and itinerary generation.
 * Can come from system (Google Places) or from user-selected places in the preference flow.
 */
export type CostLevel = "low" | "medium" | "high";

export type IntensityLevel = "low" | "medium" | "high";

export type TimeOfDay = "morning" | "afternoon" | "evening";

export type CandidateActivitySource =
  | "user_selected"
  | "voted"
  | "system_recommended"
  | "selected_and_recommended"
  | "auto_recommendation"
  | "ai_recommended_food";

export interface CandidateActivity {
  /** Google place_id or stable id for user-selected places */
  placeId: string;
  name: string;

  /** Optional for user-selected places that weren't resolved to coordinates */
  location?: {
    lat: number;
    lng: number;
  };

  /** Place types / categories (e.g. from Google types or inferred) */
  categories: string[];

  rating?: number;
  /** 0–4 typical scale from Places API */
  priceLevel?: number;

  /** Duration in minutes */
  estimatedDuration: number;

  /** Where this duration came from (for debugging/inspection) */
  durationSource?: "foursquare" | "heuristic";

  costLevel: CostLevel;
  intensity: IntensityLevel;

  /** When this activity is typically done (for scheduling) */
  suitableTime: TimeOfDay[];

  /**
   * Optional opening hours (HH:mm). If missing, overlap with commonActiveHours
   * is derived from suitableTime (morning/afternoon/evening) for filtering/scoring.
   */
  openHours?: { start: string; end: string };

  /**
   * Optional structured weekly opening hours, one entry per weekday where index 0 = Sunday
   * through 6 = Saturday (matches Date.prototype.getDay()). Each weekday is either:
   * - `null` → venue is closed that weekday
   * - an array of one or more `{ start, end }` HH:mm windows for that weekday (a venue
   *   may have a split shift, e.g. closed for siesta).
   * Missing entirely or `undefined` means we don't know — scheduler must fall back to
   * `openHours` (if any) and otherwise treat the venue as always open. A 24-hour venue
   * is represented as `[{ start: "00:00", end: "23:59" }]`.
   */
  weeklyHours?: ({ start: string; end: string }[] | null)[];

  /** Tags used for deal-breaker matching (e.g. crowded, heights, water) */
  tags?: string[];

  /** Where this candidate came from */
  source: CandidateActivitySource;

  /** Optional image URL for display (e.g. from Places photo or placeholder) */
  imageUrl?: string;

  /** Optional short description */
  description?: string;

  /** Display label for card type/category (e.g. "Museum", "Beach") */
  displayCategoryLabel?: string;

  /** When filled by vote-stage AI gap logic, short rationale for the voting card */
  aiRecommendationReason?: string;

  /** Regular closure days (e.g. "Monday", "unknown"). Populated from gap-fill AI output. */
  closedDays?: string;
  /** True when the activity is only available on specific dates/seasons. */
  timeSensitive?: boolean;
  /** True when only a subset of members should attend (budget or dealBreaker conflict). */
  splitCandidate?: boolean;
  /** Explanation for why this is a split candidate; forwarded to the scheduler. */
  splitReason?: string | null;
  /** Budget tier from the gap-fill AI ($ / $$ / $$$ / $$$$). */
  budgetTier?: string;
  /** Nearby fallback place if this activity is unavailable. */
  fallbackOption?: { placeId?: string; name: string; closedDays: string };
  /** Member IDs eligible to attend. Defaults to all members; narrowed for split candidates. */
  eligibleMembers?: string[];
}

/**
 * Candidate activity with ranking metadata for the Vote page.
 * Returned by getRankedVoteCandidates; list is already sorted by finalScore (desc).
 */
export interface RankedCandidate extends CandidateActivity {
  finalScore: number;
  groupScore: number;
  avgMemberScore: number;
  minMemberScore: number;
  selectedCount: number;
  isSelectedByAnyMember: boolean;
  /** True when aggregated votes are majority down — excluded from shared group pool but may appear as split itinerary. */
  excludedFromGroup?: boolean;
  /** Split-group meal hint: prefer lunch/dinner slot that overlaps this window when picking meals. */
  preferredTimeWindow?: { start: string; end: string };
}

