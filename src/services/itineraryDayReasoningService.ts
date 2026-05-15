import { getApiProxyBase } from "../config/apiProxy";
import { getPrimaryCategory } from "./activityEngine";
import type { RankedCandidate } from "../types/activity";
import type { ActivityVote, ItineraryDay, ScheduledActivity } from "../types/itinerary";
import type { MBTITravelSignals } from "../utils/mbtiUtils";
import type { GroupPlanningProfile, MemberPreference } from "../types/preference";
import type { SplitGroupPlanEvaluation } from "../types/splitGroupPlan";
import type { TripMember } from "../types/trip";

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function collectDayStops(d: ItineraryDay): ScheduledActivity[] {
  const stops: ScheduledActivity[] = [];
  for (const b of d.blocks) stops.push(...b.activities);
  if (d.lunchSlot.activity) stops.push(d.lunchSlot.activity);
  if (d.dinnerSlot.activity) stops.push(d.dinnerSlot.activity);
  stops.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  return stops;
}

function experienceCategory(sa: ScheduledActivity): string {
  if (sa.blockLabel === "lunch" || sa.blockLabel === "dinner") return "meal";
  const p = getPrimaryCategory(sa.activity);
  return p ?? "other";
}

function upvoterNamesForPlace(
  tripId: string,
  placeId: string,
  votes: ActivityVote[],
  memberById: Map<string, string>
): string[] {
  const names: string[] = [];
  for (const v of votes) {
    if (v.tripId !== tripId || v.placeId !== placeId || v.vote !== "up") continue;
    names.push(memberById.get(v.memberId)?.trim() || "Member");
  }
  return [...new Set(names)];
}

export type SchedulerScheduledDayPayload = {
  dayNumber: number;
  energyLevel: string;
  maxNonMealActivities: number;
  /** Experience categories in time order (no venue names). */
  experienceMix: string[];
  /** Distinct member first names who upvoted at least one scheduled non-meal stop this day. */
  honoredUpvoterNames: string[];
  hasLunch: boolean;
  hasDinner: boolean;
  nonMealStopCount: number;
};

export function buildScheduledDaysForSchedulerPayload(
  tripId: string,
  days: ItineraryDay[],
  votes: ActivityVote[],
  members: TripMember[]
): SchedulerScheduledDayPayload[] {
  const memberById = new Map(members.map((m) => [m.id, m.name.split(/\s+/)[0] ?? m.name]));
  return days.map((d) => {
    const stops = collectDayStops(d);
    const experienceMix = stops.map(experienceCategory);
    const honored = new Set<string>();
    let nonMeal = 0;
    for (const sa of stops) {
      if (sa.blockLabel === "lunch" || sa.blockLabel === "dinner") continue;
      nonMeal++;
      for (const n of upvoterNamesForPlace(tripId, sa.placeId, votes, memberById)) honored.add(n);
    }
    return {
      dayNumber: d.dayIndex,
      energyLevel: d.energyLevel,
      maxNonMealActivities: d.maxNonMealActivities,
      experienceMix,
      honoredUpvoterNames: [...honored],
      hasLunch: Boolean(d.lunchSlot.activity),
      hasDinner: Boolean(d.dinnerSlot.activity),
      nonMealStopCount: nonMeal,
    };
  });
}

export function buildSchedulerGroupContextPayload(args: {
  tripId: string;
  profile: GroupPlanningProfile;
  splitPlan: SplitGroupPlanEvaluation | undefined;
  dailyCapacityReasoning?: string;
  members: TripMember[];
  memberPreferences: MemberPreference[];
  candidatesBrief: {
    placeId: string;
    name: string;
    source: string;
    excludedFromGroup?: boolean;
    intensity?: string;
    costLevel?: string;
  }[];
}): Record<string, unknown> {
  const prefs = args.memberPreferences
    .filter((p) => p.tripId === args.tripId)
    .map((p) => ({
      memberId: p.memberId,
      budgetLevel: p.budgetLevel,
      energyLevel: p.energyLevel,
      activeHours: p.activeHours,
      activityTypes: p.activityTypes,
      dealBreakers: p.dealBreakers,
      mbti: p.mbti ?? null,
    }));

  const splitSummary = args.splitPlan
    ? {
        needsSplit: args.splitPlan.needsSplit,
        splitDays: args.splitPlan.splitDays,
        reasoning: args.splitPlan.reasoning,
        splitGroupsCount: Array.isArray(args.splitPlan.splitGroups) ? args.splitPlan.splitGroups.length : 0,
      }
    : null;

  return {
    members: args.members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    memberPreferences: prefs,
    aggregateProfile: {
      groupBudgetLevel: args.profile.groupBudgetLevel,
      groupEnergyLevel: args.profile.groupEnergyLevel,
      commonActiveHours: args.profile.commonActiveHours,
      excludedTags: args.profile.excludedTags,
      commonActivityTypes: args.profile.commonActivityTypes,
    },
    splitPlanSummary: splitSummary,
    dailyCapacityReasoning: args.dailyCapacityReasoning ?? "",
    candidatesBrief: args.candidatesBrief.slice(0, 80),
    memberPersonalities: args.profile.memberPersonalities,
    groupPlanningStyleVariance: args.profile.groupPlanningStyleVariance,
    groupSplitComfort: args.profile.groupSplitComfort,
  };
}

function memberSignalsHaveAnyNonNull(signals: MBTITravelSignals): boolean {
  return Object.values(signals).some((v) => v != null);
}

/** Per-member lines shared by itinerary scheduler and split-group plan prompts. */
export function formatMemberPersonalityLines(
  members: GroupPlanningProfile["memberPersonalities"]
): string {
  return members
    .filter((m) => memberSignalsHaveAnyNonNull(m.signals))
    .map(
      (m) =>
        `- ${m.name}:\n` +
        `    planning style: ${m.signals.planningStyle},\n` +
        `    group orientation: ${m.signals.groupOrientation},\n` +
        `    energy from people: ${m.signals.energyFromPeople},\n` +
        `    conflict approach: ${m.signals.conflictApproach},\n` +
        `    schedule rigidity: ${m.signals.scheduleRigidity}`
    )
    .join("\n");
}

/**
 * Supplementary split-group plan prompt block (after conflict list in system instructions).
 * Returns null when group-level MBTI signals are unavailable.
 */
export function buildSplitGroupPlanPersonalityPromptSection(
  profile: Pick<
    GroupPlanningProfile,
    "memberPersonalities" | "groupPlanningStyleVariance" | "groupSplitComfort"
  >
): string | null {
  const { memberPersonalities, groupPlanningStyleVariance, groupSplitComfort } = profile;

  if (groupPlanningStyleVariance == null && groupSplitComfort == null) {
    return null;
  }

  const memberLines = formatMemberPersonalityLines(memberPersonalities);
  if (!memberLines) return null;

  const splitComfort = groupSplitComfort ?? "unknown";
  const variance = groupPlanningStyleVariance ?? "unknown";

  return (
    "\n---\n" +
    "Member personality signals:\n" +
    `${memberLines}\n\n` +
    `Group split comfort: ${splitComfort}\n` +
    `Planning style variance: ${variance}\n\n` +
    "When deciding whether to recommend a split-group plan:\n" +
    '- If groupSplitComfort is "low", strongly prefer compromise shared activities ' +
    "over splits. Only recommend a split if no viable shared activity exists for " +
    "that time block.\n" +
    '- If any member has energyFromPeople "drains", frame split time positively ' +
    "in the reasoning — personal recharge time, not group conflict.\n" +
    '- If groupPlanningStyleVariance is "high", always include at least one fully ' +
    "open unscheduled half-day so P types feel autonomy while J types keep " +
    "structure around the fixed anchors (meals, top-voted activities).\n" +
    "---\n"
  );
}

/**
 * Supplementary scheduler prompt block from MBTI-derived profile fields.
 * Returns null when group-level signals are unavailable or no member has signals.
 */
export function buildItinerarySchedulerPersonalityPromptSection(
  profile: Pick<
    GroupPlanningProfile,
    "memberPersonalities" | "groupPlanningStyleVariance" | "groupSplitComfort"
  >
): string | null {
  const { memberPersonalities, groupPlanningStyleVariance, groupSplitComfort } = profile;

  if (groupPlanningStyleVariance == null && groupSplitComfort == null) {
    return null;
  }

  const memberLines = formatMemberPersonalityLines(memberPersonalities);
  if (!memberLines) return null;

  return (
    "\n---\n" +
    "Member personality signals (supplementary only — never override " +
    "groupEnergyLevel, groupBudgetLevel, excludedTags, or commonActiveHours):\n\n" +
    `${memberLines}\n\n` +
    "Group-level:\n" +
    `- Planning style variance: ${groupPlanningStyleVariance}\n` +
    `- Comfort with splitting: ${groupSplitComfort}\n\n` +
    "Use these signals to:\n" +
    "1. Adjust how split days are framed in dayReasoning. Members with " +
    'scheduleRigidity "needs_clear_plan" need the alternative plan clearly ' +
    "structured. Members with \"accept_open_days\" just need flexibility noted.\n" +
    "2. If most members have conflictApproach \"seeks_compromise\", prefer shared " +
    'activities over splits. If "direct_resolution" dominates, splits are more acceptable.\n' +
    '3. If energyFromPeople "drains" members are the majority, avoid back-to-back ' +
    "high-social activities. Build in quieter recovery time.\n" +
    '4. If groupPlanningStyleVariance is "high", include at least one unscheduled ' +
    "half-day block so P types feel freedom while J types retain structure " +
    "around meals and key voted activities.\n" +
    "5. When a personality signal shaped a decision, mention it plainly in " +
    "dayReasoning using plain language — never mention MBTI codes like INTJ " +
    "or ENFP in any user-facing text.\n" +
    "---\n"
  );
}

export type SchedulerDayInsight = {
  dayNumber: number;
  theme: string;
  dayReasoning: string;
};

/**
 * GPT-4o scheduler insight: per-day `theme` + `dayReasoning` from group context + scheduled structure.
 */
export async function fetchItinerarySchedulerDayInsights(body: {
  tripDays: number;
  tripName: string;
  destination: string;
  groupContext: Record<string, unknown>;
  scheduledDays: SchedulerScheduledDayPayload[];
  /** Appended after conflict rules in the scheduler system prompt. */
  personalityPromptAppendix?: string | null;
}): Promise<SchedulerDayInsight[] | undefined> {
  const { tripDays, tripName, destination, groupContext, scheduledDays, personalityPromptAppendix } =
    body;
  if (tripDays < 1 || scheduledDays.length !== tripDays) return undefined;

  const base = getApiProxyBase();
  try {
    const res = await fetch(`${base}/api/openai/itinerary-day-reasoning`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripDays,
        tripName,
        destination,
        groupContext,
        scheduledDays,
        ...(personalityPromptAppendix ? { personalityPromptAppendix } : {}),
      }),
    });
    if (!res.ok) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[itinerarySchedulerInsights] HTTP", res.status);
      }
      return undefined;
    }
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== "object" || "error" in (data as object)) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[itinerarySchedulerInsights] proxy error", data);
      }
      return undefined;
    }
    const days = (data as { days?: unknown }).days;
    if (!Array.isArray(days)) return undefined;
    const out: SchedulerDayInsight[] = [];
    for (const row of days) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const dayNumber = typeof r.dayNumber === "number" ? Math.floor(r.dayNumber) : NaN;
      const theme = typeof r.theme === "string" ? r.theme.trim() : "";
      const dayReasoning = typeof r.dayReasoning === "string" ? r.dayReasoning.trim() : "";
      if (!Number.isFinite(dayNumber) || dayNumber < 1) continue;
      out.push({ dayNumber, theme, dayReasoning });
    }
    out.sort((a, b) => a.dayNumber - b.dayNumber);
    if (out.length !== tripDays) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[itinerarySchedulerInsights] day count mismatch", out.length, tripDays);
      }
      return undefined;
    }
    for (let i = 0; i < tripDays; i++) {
      if (out[i]?.dayNumber !== i + 1) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn("[itinerarySchedulerInsights] dayNumber sequence mismatch");
        }
        return undefined;
      }
    }
    return out;
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[itinerarySchedulerInsights] request failed", e);
    }
    return undefined;
  }
}

export function candidatesBriefFromPool(pool: RankedCandidate[]) {
  return pool.map((c) => ({
    placeId: c.placeId,
    name: c.name,
    source: c.source,
    excludedFromGroup: c.excludedFromGroup,
    intensity: c.intensity,
    costLevel: c.costLevel,
  }));
}
