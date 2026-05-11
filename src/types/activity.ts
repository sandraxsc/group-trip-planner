/**
 * Structured candidate activity for voting and itinerary generation.
 * Can come from system (Google Places) or from user-selected places in the preference flow.
 */
export type CostLevel = "low" | "medium" | "high";

export type IntensityLevel = "low" | "medium" | "high";

export type TimeOfDay = "morning" | "afternoon" | "evening";

export type CandidateActivitySource =
  | "user_selected"
  | "system_recommended"
  | "selected_and_recommended"
  | "auto_recommendation";

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
}

