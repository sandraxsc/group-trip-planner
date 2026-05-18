import type { MBTITravelSignals } from "../utils/mbtiUtils";

/**
 * Stored per member per trip. Collected from the 7-step preference flow.
 */
export type BudgetLevel = "budget" | "moderate" | "luxury";

export type EnergyLevel = "low" | "medium" | "high";

/** Categorized deal-breaker selection from the preference flow (step 6). */
export interface DealBreakerSelection {
  /** Top-level category id */
  category: string;
  /** Selected sub-tags within this category */
  tags: string[];
  /** Free text for "other" sub-tags */
  note?: string;
}

/** Flatten categorized deal-breakers into exclusion tag ids for group aggregation. */
export const ACTIVITY_TYPE_OTHER_ID = "other";

/** Known step-4 activity ids (excludes "other"). */
export const PREFERENCE_ACTIVITY_IDS = new Set([
  "beach",
  "hiking",
  "culture",
  "food",
  "nightlife",
  "shopping",
  "spa",
  "adventure",
  "photography",
  "wildlife",
  "history",
]);

/** Build activityTypes + activityTypesOther for persistence from UI state. */
export function buildActivityTypesPreference(
  selectedIds: string[],
  otherNote: string
): Pick<MemberPreference, "activityTypes" | "activityTypesOther"> {
  const trimmedOther = otherNote.trim();
  const withoutOther = selectedIds.filter((id) => id !== ACTIVITY_TYPE_OTHER_ID);
  const includesOther = selectedIds.includes(ACTIVITY_TYPE_OTHER_ID);

  if (includesOther && trimmedOther) {
    return {
      activityTypes: [...withoutOther, ACTIVITY_TYPE_OTHER_ID],
      activityTypesOther: trimmedOther,
    };
  }
  if (includesOther) {
    return { activityTypes: [...withoutOther, ACTIVITY_TYPE_OTHER_ID] };
  }
  return {
    activityTypes: withoutOther,
    activityTypesOther: undefined,
  };
}

/** Restore UI state from saved member preference. */
export function parseActivityTypesPreference(pref: {
  activityTypes?: string[];
  activityTypesOther?: string;
}): { selectedIds: string[]; otherNote: string } {
  const types = pref.activityTypes ?? [];
  const selectedIds = types.filter(
    (id) => id !== ACTIVITY_TYPE_OTHER_ID && PREFERENCE_ACTIVITY_IDS.has(id)
  );
  const hasOther =
    types.includes(ACTIVITY_TYPE_OTHER_ID) || Boolean(pref.activityTypesOther?.trim());
  if (hasOther) selectedIds.push(ACTIVITY_TYPE_OTHER_ID);
  return {
    selectedIds,
    otherNote: pref.activityTypesOther ?? "",
  };
}

/** Flatten member activity prefs for group union / AI (ids + other:note). */
export function flattenMemberActivityTypes(pref: {
  activityTypes?: string[];
  activityTypesOther?: string;
}): string[] {
  const base = (pref.activityTypes ?? []).filter((t) => t !== ACTIVITY_TYPE_OTHER_ID);
  const out = [...base];
  const note = pref.activityTypesOther?.trim();
  if (note) {
    if (!out.includes(ACTIVITY_TYPE_OTHER_ID)) out.push(ACTIVITY_TYPE_OTHER_ID);
    out.push(`other:${note.toLowerCase()}`);
  } else if (pref.activityTypes?.includes(ACTIVITY_TYPE_OTHER_ID)) {
    out.push(ACTIVITY_TYPE_OTHER_ID);
  }
  return out;
}

export function flattenDealBreakerSelections(
  entries: DealBreakerSelection[] | undefined
): string[] {
  return (entries ?? []).flatMap((d) => [
    d.category,
    ...d.tags,
    ...(d.note ? [`other:${d.note.trim().toLowerCase()}`] : []),
  ]);
}

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

  /** From step 4: Activity type ids (e.g. beach, hiking, culture); includes "other" when custom interests are set */
  activityTypes?: string[];

  /** From step 4: Free-text interests when "other" is selected */
  activityTypesOther?: string;

  /** From step 5: Place names or ids selected for the trip */
  selectedPlaces?: string[];

  /** From step 6: Categorized deal-breaker selections */
  dealBreakers?: DealBreakerSelection[];

  /** MBTI type (e.g. INTJ, ENFP) or null if the user skipped the question. */
  mbti?: string | null;
}

/**
 * Aggregated from all members' preferences for a trip. Used by itinerary/planning logic.
 *
 * Derivation rules:
 * - tripId, destination: From Trip.
 * - groupBudgetLevel: Median budgetLevel across group members. Ordinal strings (e.g. budget/moderate/luxury) are converted to numeric ranks, median is computed, then mapped back to the corresponding string level.
 * - groupEnergyLevel: Median energyLevel across group members. Ordinal strings (e.g. low/medium/high) are converted to numeric ranks, median is computed, then mapped back to the corresponding string level.
 * - commonActiveHours: Latest activeHours.start and earliest activeHours.end across group members (true overlapping time window).
 * - commonActivityTypes: Union of all members' activityTypes and other-interest notes.
 * - excludedTags: Flat union of all members' deal-breaker categories, tags, and other notes.
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

  /** Per-member MBTI-derived travel signals (from saved mbti on each preference). */
  memberPersonalities: {
    memberId: string;
    name: string;
    signals: MBTITravelSignals;
  }[];

  /** High when the group mixes J and P types; null if fewer than 2 members provided MBTI. */
  groupPlanningStyleVariance: "low" | "high" | null;

  /** High when a majority are comfortable splitting (I types); null if fewer than 2 MBTI answers. */
  groupSplitComfort: "low" | "high" | null;
}
