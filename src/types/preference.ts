/**
 * Stored per member per trip. Collected from the 6-step preference flow.
 */
export type BudgetLevel = "budget" | "moderate" | "luxury";

export type EnergyLevel = "low" | "medium" | "high";

export interface MemberPreference {
  memberId: string;
  tripId: string;

  /** From step 1: Budget */
  budgetLevel?: BudgetLevel;

  /** From step 2: Energy (peace/walk -> low, balanced -> medium, athlete -> high) */
  energyLevel?: EnergyLevel;

  /** From step 3: Preferred active window (24h "HH:mm") */
  activeHours?: {
    start: string;
    end: string;
  };

  /** From step 4: Activity type ids (e.g. beach, hiking, culture) */
  activityTypes?: string[];

  /** From step 5: Place names or ids selected for the trip */
  selectedPlaces?: string[];

  /** From step 6: Deal breaker tags to exclude (e.g. crowded, heights) */
  dealBreakers?: string[];
}

/**
 * Aggregated from all members' preferences for a trip. Used by itinerary/planning logic.
 *
 * Derivation rules:
 * - tripId, destination: From Trip.
 * - groupBudgetLevel: Median budgetLevel across group members. Ordinal strings (e.g. budget/moderate/luxury) are converted to numeric ranks, median is computed, then mapped back to the corresponding string level.
 * - groupEnergyLevel: Median energyLevel across group members. Ordinal strings (e.g. low/medium/high) are converted to numeric ranks, median is computed, then mapped back to the corresponding string level.
 * - commonActiveHours: Latest activeHours.start and earliest activeHours.end across group members (true overlapping time window).
 * - commonActivityTypes: Union of all members' activityTypes.
 * - excludedTags: Union of all members' dealBreakers (hard exclusions).
 * - candidatePlaces: Union of all members' selectedPlaces (candidate places for voting).
 */
export interface GroupPlanningProfile {
  tripId: string;
  destination: string;

  /** Median budget level across members (ordinal: budget=1, moderate=2, luxury=3 → median rank → back to string). */
  groupBudgetLevel: string;

  /** Union of activity types any member selected */
  commonActivityTypes: string[];

  /** Median energy level across members (ordinal: low=1, medium=2, high=3 → median rank → back to string). */
  groupEnergyLevel: string;

  /** Overlapping time window: latest start, earliest end across members */
  commonActiveHours: {
    start: string;
    end: string;
  };

  /** Any deal breaker from any member → hard exclusion */
  excludedTags: string[];

  /** Union of places selected by any member (candidate places for voting) */
  candidatePlaces: string[];
}
