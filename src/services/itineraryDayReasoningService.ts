import { getApiProxyBase } from "../config/apiProxy";
import { getPrimaryCategory } from "./activityEngine";
import type { RankedCandidate } from "../types/activity";
import type { ActivityVote, ItineraryDay, ScheduledActivity } from "../types/itinerary";
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
  };
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
}): Promise<SchedulerDayInsight[] | undefined> {
  const { tripDays, tripName, destination, groupContext, scheduledDays } = body;
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
