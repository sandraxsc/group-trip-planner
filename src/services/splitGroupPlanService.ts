import { getApiProxyBase } from "../config/apiProxy";
import { buildSplitGroupPlanPersonalityPromptSection } from "./itineraryDayReasoningService";
import type { RankedCandidate } from "../types/activity";
import type { GroupPlanningProfile, MemberPreference } from "../types/preference";
import type { GroupConflict, SplitGroupPlanEvaluation } from "../types/splitGroupPlan";
import { getPrimaryCategory } from "./activityEngine";
import { getMemberPreferencesByTripId } from "./preferenceService";
import { getTripById, getTripMembers } from "./tripService";

const BUDGET_RANK: Record<string, number> = { budget: 1, moderate: 2, luxury: 3 };
const ENERGY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

type MemberPreferenceActiveHours = NonNullable<MemberPreference["activeHours"]>;

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToHhmm(totalMin: number): string {
  const wrap = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(wrap / 60);
  const m = wrap % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function rankToEnergy(r: number): string {
  if (r <= 1) return "low";
  if (r === 2) return "medium";
  return "high";
}

function rankToBudget(r: number): string {
  if (r <= 1) return "budget";
  if (r === 2) return "moderate";
  return "luxury";
}

function collectGroupProfileConflicts(
  tripId: string,
  profile: GroupPlanningProfile,
  splitCandidates: RankedCandidate[]
): GroupConflict[] {
  const prefs = getMemberPreferencesByTripId(tripId);
  const conflicts: GroupConflict[] = [];

  const energyRanks = prefs
    .map((p) => ENERGY_RANK[String(p.energyLevel ?? "").toLowerCase()])
    .filter((n): n is number => typeof n === "number");
  if (energyRanks.length >= 2) {
    const spread = Math.max(...energyRanks) - Math.min(...energyRanks);
    if (spread >= 2) {
      conflicts.push({
        type: "energy_variance",
        description:
          "Members disagree on trip energy intensity (spread spans at least two levels, e.g. relaxed vs very active).",
      });
    }
  }

  const budgetRanks = prefs
    .map((p) => BUDGET_RANK[String(p.budgetLevel ?? "").toLowerCase()])
    .filter((n): n is number => typeof n === "number");
  if (budgetRanks.length >= 2) {
    const spread = Math.max(...budgetRanks) - Math.min(...budgetRanks);
    if (spread >= 2) {
      conflicts.push({
        type: "budget_spread",
        description:
          "Budget comfort levels differ by two or more tiers across members (e.g. budget vs luxury lean).",
      });
    }
  }

  const hoursList = prefs
    .map((p) => p.activeHours)
    .filter((h): h is MemberPreferenceActiveHours => Boolean(h));
  if (hoursList.length >= 2) {
    const startMinutes = hoursList.map((h) => timeToMinutes(h.start));
    const gap = Math.max(...startMinutes) - Math.min(...startMinutes);
    if (gap >= 90) {
      conflicts.push({
        type: "active_hours_mismatch",
        description: `Preferred day-start times diverge by ${gap} minutes between earliest and latest member (early vs late starters).`,
      });
    }
  }

  if (splitCandidates.length > 0) {
    conflicts.push({
      type: "specific_venue",
      description: `At least one specific venue was majority-downvoted by the group while still explicitly desired by one or more members (${splitCandidates.length} candidate(s)).`,
    });
  }

  return conflicts;
}

function buildGroupProfileSummary(tripId: string, profile: GroupPlanningProfile) {
  const prefs = getMemberPreferencesByTripId(tripId);

  const energyRanks = prefs
    .map((p) => ENERGY_RANK[String(p.energyLevel ?? "").toLowerCase()])
    .filter((n): n is number => typeof n === "number");
  const budgetRanks = prefs
    .map((p) => BUDGET_RANK[String(p.budgetLevel ?? "").toLowerCase()])
    .filter((n): n is number => typeof n === "number");

  const hoursList = prefs
    .map((p) => p.activeHours)
    .filter((h): h is MemberPreferenceActiveHours => Boolean(h));

  let earlyStart = profile.commonActiveHours.start;
  let coreStart = profile.commonActiveHours.start;
  if (hoursList.length > 0) {
    const mins = hoursList.map((h) => timeToMinutes(h.start));
    earlyStart = minutesToHhmm(Math.min(...mins));
    coreStart = minutesToHhmm(Math.max(...mins));
  }

  const energyFloor =
    energyRanks.length === 0
      ? String(profile.groupEnergyLevel ?? "medium").toLowerCase()
      : rankToEnergy(Math.min(...energyRanks));
  const energyCeiling =
    energyRanks.length === 0
      ? String(profile.groupEnergyLevel ?? "medium").toLowerCase()
      : rankToEnergy(Math.max(...energyRanks));

  const budgetFloor =
    budgetRanks.length === 0
      ? String(profile.groupBudgetLevel ?? "moderate").toLowerCase()
      : rankToBudget(Math.min(...budgetRanks));
  const budgetCeiling =
    budgetRanks.length === 0
      ? String(profile.groupBudgetLevel ?? "moderate").toLowerCase()
      : rankToBudget(Math.max(...budgetRanks));

  return {
    energyFloor,
    energyCeiling,
    budgetFloor,
    budgetCeiling,
    activeWindow: {
      start: profile.commonActiveHours.start,
      end: profile.commonActiveHours.end,
    },
    earlyStart,
    coreStart,
  };
}

function slimCandidates(list: RankedCandidate[]) {
  return list.map((c) => ({
    placeId: c.placeId,
    name: c.name,
    category: getPrimaryCategory(c),
    energyCost: c.intensity,
    priceLevel: c.priceLevel ?? null,
  }));
}

function normalizeFromAi(data: unknown): SplitGroupPlanEvaluation {
  if (!data || typeof data !== "object") return { needsSplit: false, personalityInfluenced: false };
  const o = data as Record<string, unknown>;
  const personalityInfluenced = o.personalityInfluenced === true;
  if (o.needsSplit !== true) return { needsSplit: false, personalityInfluenced };
  const splitDays =
    typeof o.splitDays === "number" && Number.isFinite(o.splitDays) ? Math.max(0, Math.floor(o.splitDays)) : 0;
  const groupActivities = Array.isArray(o.groupActivities)
    ? o.groupActivities.filter((x): x is string => typeof x === "string")
    : [];
  const reasoning = typeof o.reasoning === "string" ? o.reasoning : "";
  const rawGroups = Array.isArray(o.splitGroups) ? o.splitGroups : [];
  const splitGroups = rawGroups
    .filter((g): g is Record<string, unknown> => g != null && typeof g === "object")
    .map((g) => {
      const memberIds = Array.isArray(g.memberIds)
        ? g.memberIds.filter((x): x is string => typeof x === "string")
        : [];
      const activities = Array.isArray(g.activities)
        ? g.activities.filter((x): x is string => typeof x === "string")
        : [];
      const tw = g.timeWindow;
      let timeWindow = { start: "09:00", end: "12:00" };
      if (tw && typeof tw === "object") {
        const t = tw as Record<string, unknown>;
        const start = typeof t.start === "string" ? t.start : timeWindow.start;
        const end = typeof t.end === "string" ? t.end : timeWindow.end;
        timeWindow = { start, end };
      }
      return { memberIds, activities, timeWindow };
    });
  return {
    needsSplit: true,
    splitDays,
    groupActivities,
    splitGroups,
    reasoning,
    personalityInfluenced,
  };
}

/**
 * Uses deterministic group-conflict checks first; only when conflicts exist, calls OpenAI (gpt-4o)
 * via the proxy to decide whether a partial split-group itinerary is warranted.
 */
export async function evaluateSplitGroupPlan(
  tripId: string,
  groupCandidates: RankedCandidate[],
  splitCandidates: RankedCandidate[],
  profile: GroupPlanningProfile
): Promise<SplitGroupPlanEvaluation> {
  const conflicts = collectGroupProfileConflicts(tripId, profile, splitCandidates);
  if (conflicts.length === 0) return { needsSplit: false, personalityInfluenced: false };

  const trip = getTripById(tripId);
  const tripDays = Math.max(1, trip?.tripDays ?? 3);
  const groupProfile = buildGroupProfileSummary(tripId, profile);
  const memberIds = getTripMembers(tripId).map((m) => m.id);
  const personalityPromptAppendix = buildSplitGroupPlanPersonalityPromptSection(profile);

  const base = getApiProxyBase();
  const body = JSON.stringify({
    tripId,
    tripDays,
    conflicts,
    groupCandidates: slimCandidates(groupCandidates),
    splitCandidates: slimCandidates(splitCandidates),
    groupProfile,
    memberIds,
    memberPersonalities: profile.memberPersonalities,
    groupPlanningStyleVariance: profile.groupPlanningStyleVariance,
    groupSplitComfort: profile.groupSplitComfort,
    ...(personalityPromptAppendix ? { personalityPromptAppendix } : {}),
  });
  try {
    let res: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(`${base}/api/openai/split-group-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        break;
      } catch (e) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        throw e;
      }
    }
    if (!res) throw new Error("split-group-plan: no response");
    if (!res.ok) {
      console.warn("[splitGroupPlan] OpenAI route failed", res.status);
      return { needsSplit: false, personalityInfluenced: false };
    }
    const data = (await res.json()) as unknown;
    if (data && typeof data === "object" && "error" in (data as object)) {
      console.warn("[splitGroupPlan] proxy error payload", data);
      return { needsSplit: false, personalityInfluenced: false };
    }
    return normalizeFromAi(data);
  } catch (e) {
    console.warn("[splitGroupPlan] request error", e);
    return { needsSplit: false, personalityInfluenced: false };
  }
}
