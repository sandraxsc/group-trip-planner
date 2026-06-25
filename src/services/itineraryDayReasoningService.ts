import { getApiProxyBase } from "../config/apiProxy";
import { getPrimaryCategory, candidateMatchesMemberSelectedPlaces } from "./activityEngine";
import type { RankedCandidate } from "../types/activity";
import type { ItineraryDay, ScheduledActivity } from "../types/itinerary";
import type { MBTITravelSignals } from "../utils/mbtiUtils";
import type { GroupPlanningProfile, MemberPreference } from "../types/preference";
import type { SplitGroupPlanEvaluation } from "../types/splitGroupPlan";
import type { GroupType, TripMember } from "../types/trip";

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

function preferenceBackerNamesForPlace(
  tripId: string,
  placeId: string,
  activityName: string,
  memberPreferences: MemberPreference[],
  memberById: Map<string, string>
): string[] {
  const names: string[] = [];
  for (const pref of memberPreferences) {
    if (pref.tripId !== tripId) continue;
    if (
      !candidateMatchesMemberSelectedPlaces(pref.selectedPlaces, {
        placeId,
        name: activityName,
      })
    ) {
      continue;
    }
    names.push(memberById.get(pref.memberId)?.trim() || "Member");
  }
  return [...new Set(names)];
}

export type SchedulerScheduledDayPayload = {
  dayNumber: number;
  energyLevel: string;
  maxNonMealActivities: number;
  /** Experience categories in time order (no venue names). */
  experienceMix: string[];
  /** Distinct member first names who selected at least one scheduled non-meal stop this day in preferences. */
  honoredPreferenceNames: string[];
  hasLunch: boolean;
  hasDinner: boolean;
  nonMealStopCount: number;
};

export function buildScheduledDaysForSchedulerPayload(
  tripId: string,
  days: ItineraryDay[],
  memberPreferences: MemberPreference[],
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
      for (const n of preferenceBackerNamesForPlace(
        tripId,
        sa.placeId,
        sa.name,
        memberPreferences,
        memberById
      )) {
        honored.add(n);
      }
    }
    return {
      dayNumber: d.dayIndex,
      energyLevel: d.energyLevel,
      maxNonMealActivities: d.maxNonMealActivities,
      experienceMix,
      honoredPreferenceNames: [...honored],
      // Legacy key consumed by itinerary-day-reasoning proxy instructions (preference-backed, not votes).
      honoredUpvoterNames: [...honored],
      hasLunch: Boolean(d.lunchSlot.activity),
      hasDinner: Boolean(d.dinnerSlot.activity),
      nonMealStopCount: nonMeal,
    };
  });
}

/**
 * Compact single-string planning directive per group type.
 * Pre-encodes all scheduling rules so the AI reads one sentence instead of
 * inferring from a multi-field object — saves tokens and prevents drift.
 * Returns null for unknown/missing types so the scheduler stays neutral.
 *
 * Keep map keys in sync with `GroupType` in `src/types/trip.ts` —
 * `Record<GroupType, …>` enforces exhaustiveness at compile time.
 */
function buildGroupTypePlanningDirective(
  groupType: GroupType | null | undefined
): string | null {
  if (!groupType) return null;
  const map: Record<GroupType, string> = {
    colleagues:
      "Professional colleagues on a team-building trip — favour shared collaborative activities (workshops, cooking classes, group challenges); semi-formal to casual venues; no late-night or overly personal activities; alcohol optional and light.",
    family:
      "Family group, likely mixed ages with children — child-safe and family-friendly venues only; at least one kid-oriented stop per day on multi-day trips; earlier dinners (18:00–19:00); rest time between stops; no nightlife.",
    couple:
      "Romantic couple — prioritise scenic, intimate, and elevated venues; prefer quiet restaurants over large/busy ones; include a sunset or evening highlight; at least one fine-dining dinner; spa and relaxation activities welcome; no need to split.",
    close_friends:
      "Close friends who know each other well — high-energy and adventure activities welcome; nightlife and bars are appropriate; split-group options encouraged when interests diverge; group is comfortable with spontaneity.",
    meetup:
      "Strangers meeting through a shared interest — public, neutral, and widely appealing venues only; structured activities that help break the ice; build in optional participation; avoid physically demanding or overly personal activities; no assumptions about shared comfort levels.",
    new_friends:
      "Friends still getting to know each other — favour group dining and shared activities over solo exploration; encourage conversation-friendly settings; avoid niche or demanding activities; relaxed atmosphere helps bonding; keep the group together.",
  };
  return map[groupType] ?? null;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Derive the weekday names for a trip's days given the start date.
 * Lets the AI reason about weekend vs. weekday opening hours and events.
 */
function deriveTripWeekdays(startDate: string, _tripDays?: number): string[] | null {
  try {
    const base = new Date(`${startDate}T12:00:00`);
    if (isNaN(base.getTime())) return null;
    // Return the weekday of day 1 only — callers can infer subsequent days.
    // Enough context for the AI without shipping a full array per trip.
    return [WEEKDAY_NAMES[base.getDay()] ?? "Unknown"];
  } catch {
    return null;
  }
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
  /** Trip start date as YYYY-MM-DD, used to communicate season and day-of-week to the AI. */
  tripStartDate?: string;
  /** Expected total group size from trip creation (may exceed the number of joined members). */
  expectedGroupSize?: number;
}): Record<string, unknown> {
  const prefs = args.memberPreferences
    .filter((p) => p.tripId === args.tripId)
    .map((p) => ({
      memberId: p.memberId,
      budgetLevel: p.budgetLevel,
      energyLevel: p.energyLevel,
      activeHours: p.activeHours,
      activityTypes: p.activityTypes,
      activityTypesOther: p.activityTypesOther ?? null,
      dealBreakers: p.dealBreakers,
      mbti: p.mbti ?? null,
    }));

  const splitSummary = args.splitPlan && args.splitPlan.needsSplit
    ? {
        needsSplit: args.splitPlan.needsSplit,
        splitDays: args.splitPlan.splitDays,
        reasoning: args.splitPlan.reasoning,
        splitGroupsCount: Array.isArray(args.splitPlan.splitGroups) ? args.splitPlan.splitGroups.length : 0,
      }
    : null;

  return {
    members: args.members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    joinedMemberCount: args.members.length,
    expectedGroupSize: args.expectedGroupSize ?? args.members.length,
    memberPreferences: prefs,
    candidateRankingNote:
      "Activity candidates are ranked by group preference compatibility (budget, energy, active hours, activity types, member place selections, deal-breaker exclusions).",
    aggregateProfile: {
      groupBudgetLevel: args.profile.groupBudgetLevel,
      groupEnergyLevel: args.profile.groupEnergyLevel,
      commonActiveHours: args.profile.commonActiveHours,
      excludedTags: args.profile.excludedTags,
      commonActivityTypes: args.profile.commonActivityTypes,
    },
    tripStartDate: args.tripStartDate ?? null,
    tripWeekdays: args.tripStartDate
      ? deriveTripWeekdays(args.tripStartDate, prefs.length > 0 ? undefined : 1)
      : null,
    splitPlanSummary: splitSummary,
    dailyCapacityReasoning: args.dailyCapacityReasoning ?? "",
    candidatesBrief: args.candidatesBrief.slice(0, 80),
    memberPersonalities: args.profile.memberPersonalities,
    groupPlanningStyleVariance: args.profile.groupPlanningStyleVariance,
    groupSplitComfort: args.profile.groupSplitComfort,
    groupType: args.profile.groupType ?? null,
    groupTypePlanningDirective: buildGroupTypePlanningDirective(args.profile.groupType),
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
    "structure around the fixed anchors (meals, preference-selected activities).\n" +
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
    "Use these signals in dayReasoning only (follow main dayReasoning rules: name a " +
    "member, cite a concrete constraint, explain WHY not WHAT, no banned phrases):\n" +
    "1. Name the member when citing scheduleRigidity (needs_clear_plan vs accept_open_days) " +
    "or how split vs together time affects them.\n" +
    "2. If conflictApproach or groupOrientation shaped pacing, say which member and how " +
    "(plain language — never INTJ/ENFP codes).\n" +
    '3. If energyFromPeople "drains" applies, name that member and why recovery gaps ' +
    "matter for this day's structure.\n" +
    '4. If groupPlanningStyleVariance is "high", explain why open time vs fixed anchors ' +
    "were placed this way for named members.\n" +
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

type DayInsightStreamCallbacks = {
  onDayComplete?: (day: SchedulerDayInsight) => void;
  onError?: (message: string) => void;
};

/**
 * Streaming variant of {@link fetchItinerarySchedulerDayInsights}.
 *
 * Connects to the `/api/openai/itinerary-day-reasoning/stream` SSE endpoint and
 * calls `callbacks.onDayComplete` each time the server emits a completed day
 * insight object from the partial JSON stream. Returns the full normalized
 * `SchedulerDayInsight[]` from the final `done` event, or `undefined` on error.
 */
export async function streamItinerarySchedulerDayInsights(
  body: {
    tripDays: number;
    tripName: string;
    destination: string;
    groupContext: Record<string, unknown>;
    scheduledDays: SchedulerScheduledDayPayload[];
    personalityPromptAppendix?: string | null;
  },
  callbacks: DayInsightStreamCallbacks = {}
): Promise<SchedulerDayInsight[] | undefined> {
  const { tripDays, tripName, destination, groupContext, scheduledDays, personalityPromptAppendix } = body;
  if (tripDays < 1 || scheduledDays.length !== tripDays) return undefined;

  const base = getApiProxyBase();
  let res: Response;
  try {
    res = await fetch(`${base}/api/openai/itinerary-day-reasoning/stream`, {
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
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[streamDayInsights] fetch failed", e);
    return undefined;
  }

  if (!res.ok || !res.body) {
    if (import.meta.env.DEV) console.warn("[streamDayInsights] HTTP", res.status);
    return undefined;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";
  let finalDays: SchedulerDayInsight[] | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const rawData = trimmed.slice(5).trim();
        if (!rawData || rawData === "[DONE]") continue;
        try {
          const evt = JSON.parse(rawData) as Record<string, unknown>;
          if (evt.type === "day" && typeof evt.dayNumber === "number") {
            const day: SchedulerDayInsight = {
              dayNumber: evt.dayNumber as number,
              theme: String(evt.theme ?? ""),
              dayReasoning: String(evt.dayReasoning ?? ""),
            };
            callbacks.onDayComplete?.(day);
          } else if (evt.type === "done" && Array.isArray(evt.days)) {
            finalDays = (evt.days as unknown[])
              .filter(
                (d): d is { dayNumber: number; theme: string; dayReasoning: string } =>
                  d != null && typeof (d as Record<string, unknown>).dayNumber === "number"
              )
              .map((d) => ({
                dayNumber: d.dayNumber,
                theme: String(d.theme ?? ""),
                dayReasoning: String(d.dayReasoning ?? ""),
              }));
          } else if (evt.type === "error") {
            if (import.meta.env.DEV) console.warn("[streamDayInsights] error event", evt.message);
            callbacks.onError?.(String(evt.message ?? "Stream error"));
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[streamDayInsights] read error", e);
  }

  if (!finalDays || finalDays.length !== tripDays) return undefined;
  finalDays.sort((a, b) => a.dayNumber - b.dayNumber);
  for (let i = 0; i < tripDays; i++) {
    if (finalDays[i]?.dayNumber !== i + 1) return undefined;
  }
  return finalDays;
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
