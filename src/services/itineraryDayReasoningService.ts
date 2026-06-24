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
 * Per-group-type prompt context — fed to the AI scheduler so prompts can
 * tune pacing, venue formality, and tone without hard-coding rules in the
 * model. Returning `null` for an unknown / missing groupType is intentional:
 * the prompt template branches on its presence rather than substituting a
 * default, so absent context means the scheduler stays neutral.
 *
 * Keep the map keys in sync with the `GroupType` union in `src/types/trip.ts`
 * — TypeScript's `Record<GroupType, …>` will fail compilation if a new
 * variant is added but not covered here, so divergence is hard to miss.
 */
function buildGroupTypeContext(
  groupType: GroupType | null | undefined
): Record<string, unknown> | null {
  if (!groupType) return null;
  const map: Record<GroupType, Record<string, unknown>> = {
    colleagues: {
      socialDynamic: "professional colleagues on a team-building trip",
      intimacyLevel: "low",
      alcoholSuitability: "optional — keep it light or skip",
      venueFormality: "semi-formal to casual",
      childrenLikely: false,
      romanticTone: false,
      splitGroupLikelihood: "low — group prefers to stay together",
      planningNotes:
        "Prioritise shared group activities that build trust and collaboration. Avoid overly personal or physically demanding activities. No late-night venues. Ice-breaker and team-challenge style activities are a plus.",
    },
    family: {
      socialDynamic: "family group, likely mixed ages and may include children",
      intimacyLevel: "high",
      alcoholSuitability: "family-friendly only",
      venueFormality: "casual",
      childrenLikely: true,
      romanticTone: false,
      splitGroupLikelihood:
        "medium — adults and kids may do different activities",
      planningNotes:
        "Prioritise family-friendly and child-safe activities. Include rest time between stops. Prefer earlier dinner slots (18:00–19:00). Avoid nightlife. Include at least one kid-oriented stop per day if trip is 2+ days.",
    },
    couple: {
      socialDynamic: "romantic couple",
      intimacyLevel: "very high",
      alcoholSuitability: "wine and cocktails welcome",
      venueFormality: "elevated casual to fine dining",
      childrenLikely: false,
      romanticTone: true,
      splitGroupLikelihood: "none — always together",
      planningNotes:
        "Prioritise scenic, romantic, and intimate venues. Prefer smaller or quieter restaurants over large busy ones. Include a sunset or evening activity. Fine dining for at least one dinner. Spa or relaxation activities are appropriate.",
    },
    close_friends: {
      socialDynamic: "close friends who know each other very well",
      intimacyLevel: "high",
      alcoholSuitability: "yes, nightlife and bars welcome",
      venueFormality: "casual",
      childrenLikely: false,
      romanticTone: false,
      splitGroupLikelihood:
        "high — comfortable splitting into sub-groups by interest",
      planningNotes:
        "High energy activities are welcome. Nightlife, bars, and late-evening plans are appropriate. Group is comfortable with spontaneity. Adventure and physical activities are a plus. Split-group planning is encouraged when interests diverge.",
    },
    meetup: {
      socialDynamic:
        "strangers meeting through a shared interest or community event",
      intimacyLevel: "very low",
      alcoholSuitability: "optional — public social settings only",
      venueFormality: "casual",
      childrenLikely: false,
      romanticTone: false,
      splitGroupLikelihood:
        "medium — some people may opt out of activities",
      planningNotes:
        "Prioritise public, neutral, and widely appealing venues. Avoid overly personal or physically demanding activities. Build in optional participation — not everyone needs to do every activity. Structured group activities help break the ice. Avoid assumptions about shared comfort levels.",
    },
    new_friends: {
      socialDynamic: "friends who do not know each other very well yet",
      intimacyLevel: "low to medium",
      alcoholSuitability: "casual social drinking is fine",
      venueFormality: "casual",
      childrenLikely: false,
      romanticTone: false,
      splitGroupLikelihood:
        "low — group benefits from shared experiences to bond",
      planningNotes:
        "Choose activities that encourage conversation and shared experience. Prefer group dining and group activities over individual exploration. Avoid overly niche or demanding activities. A balance of fun and relaxed atmosphere helps bonding.",
    },
  };
  return map[groupType] ?? null;
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
    splitPlanSummary: splitSummary,
    dailyCapacityReasoning: args.dailyCapacityReasoning ?? "",
    candidatesBrief: args.candidatesBrief.slice(0, 80),
    memberPersonalities: args.profile.memberPersonalities,
    groupPlanningStyleVariance: args.profile.groupPlanningStyleVariance,
    groupSplitComfort: args.profile.groupSplitComfort,
    // Set by the trip leader at creation. The raw enum lets the model
    // branch on the literal value; the resolved context object spells out
    // intent for prompts that would rather read prose than know the union.
    groupType: args.profile.groupType ?? null,
    groupTypeContext: buildGroupTypeContext(args.profile.groupType),
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
