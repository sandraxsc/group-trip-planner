import { getApiProxyBase } from "../config/apiProxy";
import type { RankedCandidate } from "../types/activity";
import type { GroupPlanningProfile, MemberPreference } from "../types/preference";
import { getTripById } from "./tripService";
import { getMemberPreferencesByTripId } from "./preferenceService";
import { timeToMinutes } from "../utils/timeUtils";

/** When OpenAI daily-capacity fails; also sizes vote-candidate list before capacity is known. */
export const DEFAULT_MAX_ACTIVITIES_PER_DAY = 3;

const DEFAULT_TRIP_DAYS = 3;

export function defaultMaxActivitiesPerDay(): number {
  return DEFAULT_MAX_ACTIVITIES_PER_DAY;
}

/** Vote screen / ranking pool cap: tripDays × default max + 5. */
export function computeVoteCandidateLimitForTrip(tripId: string): number {
  const trip = getTripById(tripId);
  const tripDays = trip?.tripDays ?? DEFAULT_TRIP_DAYS;
  return Math.max(1, tripDays * defaultMaxActivitiesPerDay()) + 5;
}

/** Minimum non-meal places to try to keep in the group pool (sum of per-day GPT caps). */
export function totalNonMealSlotsAcrossTrip(
  capacity: Pick<DailyCapacityResult, "maxPerDayByDayIndex" | "maxActivitiesPerDay">,
  tripDays: number
): number {
  const days = Math.max(1, tripDays);
  if (capacity.maxPerDayByDayIndex.length >= days) {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      sum += capacity.maxPerDayByDayIndex[i] ?? capacity.maxActivitiesPerDay;
    }
    return Math.max(1, sum);
  }
  return Math.max(1, days * capacity.maxActivitiesPerDay);
}

const ENERGY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

type MemberPreferenceActiveHours = NonNullable<MemberPreference["activeHours"]>;

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

function clampDailyCap(n: number): number {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return 3;
  return Math.min(10, Math.max(1, x));
}

function buildEnergyMetrics(tripId: string, profile: GroupPlanningProfile) {
  const prefs = getMemberPreferencesByTripId(tripId);
  const energyRanks = prefs
    .map((p) => ENERGY_RANK[String(p.energyLevel ?? "").toLowerCase()])
    .filter((r): r is number => typeof r === "number");

  const energyFloor =
    energyRanks.length === 0
      ? String(profile.groupEnergyLevel ?? "medium").toLowerCase()
      : rankToEnergy(Math.min(...energyRanks));
  const energyCeiling =
    energyRanks.length === 0
      ? String(profile.groupEnergyLevel ?? "medium").toLowerCase()
      : rankToEnergy(Math.max(...energyRanks));
  const energyVariance =
    energyRanks.length >= 2 ? Math.max(...energyRanks) - Math.min(...energyRanks) : 0;

  const hoursList = prefs
    .map((p) => p.activeHours)
    .filter((h): h is MemberPreferenceActiveHours => Boolean(h));

  let coreStart = profile.commonActiveHours.start;
  if (hoursList.length > 0) {
    const mins = hoursList.map((h) => timeToMinutes(h.start));
    coreStart = minutesToHhmm(Math.max(...mins));
  }

  const end = profile.commonActiveHours.end;
  let activeWindowHours =
    (timeToMinutes(end) - timeToMinutes(coreStart)) / 60;
  if (!Number.isFinite(activeWindowHours) || activeWindowHours <= 0) {
    activeWindowHours = Math.max(0.5, (timeToMinutes(end) - timeToMinutes(profile.commonActiveHours.start)) / 60);
  }

  return {
    energyFloor,
    energyCeiling,
    energyVariance,
    coreStart,
    activeWindowHours: Math.round(activeWindowHours * 100) / 100,
  };
}

export type DailyCapacityResult = {
  /** Cap per day for dayIndex 0 … tripDays−1 */
  maxPerDayByDayIndex: number[];
  /** Uniform cap (median / default when no per-day variance) */
  maxActivitiesPerDay: number;
  reasoning?: string;
  dayVariance: boolean;
  source: "openai" | "fallback";
};

function fallbackCapacity(tripDays: number): DailyCapacityResult {
  const m = defaultMaxActivitiesPerDay();
  const maxPerDayByDayIndex = Array.from({ length: tripDays }, () => m);
  return {
    maxPerDayByDayIndex,
    maxActivitiesPerDay: m,
    dayVariance: false,
    source: "fallback",
  };
}

/**
 * Uses GPT‑4o (temperature 0.2) to recommend max non‑meal activities per day from group energy,
 * active window, trip length, candidate intensities, and split‑plan context. Falls back to
 * `defaultMaxActivitiesPerDay` on any failure.
 */
export async function evaluateDailyCapacity(
  profile: GroupPlanningProfile,
  tripDays: number,
  candidates: RankedCandidate[],
  splitPlanExists: boolean
): Promise<DailyCapacityResult> {
  const fallback = fallbackCapacity(tripDays);
  const tripId = profile.tripId;
  const energy = buildEnergyMetrics(tripId, profile);
  const candidatePayload = candidates.map((c) => ({
    placeId: c.placeId,
    name: c.name,
    energyCost: c.intensity,
  }));

  const base = getApiProxyBase();
  try {
    const res = await fetch(`${base}/api/openai/daily-capacity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId,
        tripDays,
        energyFloor: energy.energyFloor,
        energyCeiling: energy.energyCeiling,
        energyVariance: energy.energyVariance,
        activeWindowHours: energy.activeWindowHours,
        coreStart: energy.coreStart,
        commonActiveEnd: profile.commonActiveHours.end,
        splitPlanExists,
        candidates: candidatePayload,
      }),
    });
    if (!res.ok) {
      console.warn("[dailyCapacity] proxy HTTP", res.status);
      return fallback;
    }
    const data = (await res.json()) as unknown;
    if (data && typeof data === "object" && "error" in (data as object)) {
      console.warn("[dailyCapacity] proxy error", data);
      return fallback;
    }
    return normalizeDailyCapacityResponse(data, tripDays, fallback);
  } catch (e) {
    console.warn("[dailyCapacity] request failed", e);
    return fallback;
  }
}

function normalizeDailyCapacityResponse(
  data: unknown,
  tripDays: number,
  fallback: DailyCapacityResult
): DailyCapacityResult {
  if (!data || typeof data !== "object") return fallback;
  const o = data as Record<string, unknown>;
  const fb = defaultMaxActivitiesPerDay();
  const baseMax = clampDailyCap(typeof o.maxActivitiesPerDay === "number" ? o.maxActivitiesPerDay : fb);
  const reasoning = typeof o.reasoning === "string" ? o.reasoning : undefined;
  const dayVariance = o.dayVariance === true;
  const raw = Array.isArray(o.perDayOverride) ? o.perDayOverride : [];

  if (dayVariance && raw.length > 0) {
    const byDay = new Map<number, number>();
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const dn = typeof r.dayNumber === "number" ? Math.floor(r.dayNumber) : NaN;
      const mx = typeof r.maxActivities === "number" ? clampDailyCap(r.maxActivities) : baseMax;
      if (dn >= 1 && dn <= tripDays) byDay.set(dn, mx);
    }
    if (byDay.size === tripDays) {
      const maxPerDayByDayIndex: number[] = [];
      for (let d = 1; d <= tripDays; d++) {
        maxPerDayByDayIndex.push(byDay.get(d) ?? baseMax);
      }
      return {
        maxPerDayByDayIndex,
        maxActivitiesPerDay: baseMax,
        reasoning,
        dayVariance: true,
        source: "openai",
      };
    }
  }

  const maxPerDayByDayIndex = Array.from({ length: tripDays }, () => baseMax);
  return {
    maxPerDayByDayIndex,
    maxActivitiesPerDay: baseMax,
    reasoning,
    dayVariance: false,
    source: "openai",
  };
}
