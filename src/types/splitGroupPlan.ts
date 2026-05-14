/** Conflict signals derived from member prefs + split candidate pool (pre–OpenAI gate). */
export type GroupConflictType =
  | "energy_variance"
  | "budget_spread"
  | "active_hours_mismatch"
  | "specific_venue";

export interface GroupConflict {
  type: GroupConflictType;
  description: string;
}

/** Result of `evaluateSplitGroupPlan` (no AI when `needsSplit` is false at gate). */
export type SplitGroupPlanEvaluation =
  | { needsSplit: false }
  | {
      needsSplit: true;
      splitDays: number;
      groupActivities: string[];
      splitGroups: Array<{
        memberIds: string[];
        activities: string[];
        timeWindow: { start: string; end: string };
      }>;
      reasoning: string;
    };
