import { getApiProxyBase } from "../config/apiProxy";
import {
  buildBoostedPlaceTypesUnion,
  candidateMatchesGroupPreferencePlaceTypes,
} from "../constants/activityMapping";
import type { CandidateActivity } from "../types/activity";
import type {
  VoteGapFillRequest,
  VoteGapFillResponse,
  VoteGapRecommendation,
  VoteGapReportPayload,
  VoteGapReplacementRequest,
  VoteGapReplacementResponse,
} from "../types/voteGapFill";
import {
  activityTagsIntersectExcluded,
  computeVoteCandidateLimitForTrip,
  getPrimaryCategory,
  type RankedCandidate,
} from "./activityEngine";
import { enrichDurationWithFoursquare } from "./foursquareService";
import { fetchPlacesForDestination } from "./placeService";
import { COST_RANGE_BY_BUDGET, generateGroupPlanningProfile } from "./planningService";

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesLikelyDuplicate(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  if (shorter.length >= 8 && longer.includes(shorter)) return true;
  return false;
}

function nameTokens(s: string): string[] {
  return normalizeName(s)
    .split(" ")
    .filter((t) => t.length >= 2);
}

/** 0–1: how well place name matches the AI-suggested venue name (reduces picking the same top hit for every query). */
function nameMatchScore(placeName: string, recName: string): number {
  const pt = nameTokens(placeName);
  const rt = nameTokens(recName);
  if (!rt.length) return 0;
  const pset = new Set(pt);
  let hit = 0;
  for (const t of rt) {
    if (pset.has(t)) {
      hit += 1;
      continue;
    }
    let partial = false;
    for (const p of pt) {
      if (p.length >= 4 && (p.includes(t) || t.includes(p))) {
        partial = true;
        break;
      }
    }
    if (partial) hit += 0.45;
  }
  return hit / rt.length;
}

function budgetFloorDescription(groupBudgetLevel: string | undefined): string {
  const level = groupBudgetLevel?.toLowerCase() ?? "moderate";
  const cr = COST_RANGE_BY_BUDGET[level] ?? COST_RANGE_BY_BUDGET.moderate;
  if (level === "budget") {
    return `Budget-conscious group (budgetFloor): prefer free or low-cost entry experiences; keep typical paid activity spend low vs ~${cr.maxPerDay ?? 50} USD/day excluding lodging. Recommend the affordable base option; put pricier alternatives only in upgradeNote.`;
  }
  if (level === "luxury") {
    return `Higher-spend group (budgetFloor): still recommend a sensible base ticket or standard visit tier first; luxury variants belong in upgradeNote.`;
  }
  return `Moderate budget (budgetFloor): aim for experiences that fit roughly ${cr.minPerDay ?? 50}–${cr.maxPerDay ?? 150} USD/day activity-style spending where relevant; prefer base tiers and note upscale options in upgradeNote.`;
}

/** Gap metrics for vote-stage AI fill (OpenAI + Places). */
export function buildVoteGapReport(
  tripId: string,
  candidates: RankedCandidate[],
  nonFoodDeficit = 0
): VoteGapReportPayload {
  const profile = generateGroupPlanningProfile(tripId);
  const limit = computeVoteCandidateLimitForTrip(tripId);
  const slotsNeeded = Math.max(0, limit - candidates.length);

  const missingPreferenceActivityIds: string[] = [];
  for (const prefId of profile?.commonActivityTypes ?? []) {
    const types = buildBoostedPlaceTypesUnion([prefId]);
    const hasMatch = candidates.some((c) =>
      candidateMatchesGroupPreferencePlaceTypes(c.categories, types)
    );
    if (!hasMatch) missingPreferenceActivityIds.push(prefId);
  }

  const primaryHistogram = new Map<string, number>();
  for (const c of candidates) {
    const p = getPrimaryCategory(c);
    primaryHistogram.set(p, (primaryHistogram.get(p) ?? 0) + 1);
  }
  let skewedCategory: string | undefined;
  if (candidates.length >= 5) {
    let maxC = 0;
    let maxKey = "";
    for (const [k, v] of primaryHistogram) {
      if (v > maxC) {
        maxC = v;
        maxKey = k;
      }
    }
    if (maxC / candidates.length >= 0.65 && maxKey !== "other") skewedCategory = maxKey;
  }

  const hasDiversityGap =
    missingPreferenceActivityIds.length > 0 || skewedCategory !== undefined;

  const statedGaps: string[] = [];
  if (slotsNeeded > 0) {
    statedGaps.push(
      `Need ${slotsNeeded} more distinct voting option(s) to reach target pool size (${limit} max for this trip length and energy).`
    );
  }
  for (const id of missingPreferenceActivityIds) {
    statedGaps.push(`Missing coverage for group preference activity type: "${id}".`);
  }
  if (skewedCategory) {
    statedGaps.push(
      `Experience mix is skewed toward "${skewedCategory}" — add qualitatively different options and aim for geographic spread across the destination.`
    );
  }

  return {
    slotsNeeded,
    hasDiversityGap,
    missingPreferenceActivityIds,
    statedGaps,
    budgetFloor: budgetFloorDescription(profile?.groupBudgetLevel),
    destination: profile?.destination ?? "",
  };
}

export function shouldTriggerVoteGapFill(
  gap: VoteGapReportPayload,
  minRecommendationCount = 0
): boolean {
  if (minRecommendationCount >= 1) return true;
  return gap.slotsNeeded >= 1 || gap.hasDiversityGap;
}

/**
 * How many AI rows to request (capped for latency/cost). Matches proxy max of 10.
 * When the pool is almost full (small slotsNeeded) but hasDiversityGap is true (e.g. missing
 * "history"), we still ask for several suggestions so voting isn't a single filler card.
 * `minRecommendationCount` (e.g. itinerary non-food deficit) raises the floor when larger.
 */
export function voteGapRecommendationCount(
  gap: VoteGapReportPayload,
  minRecommendationCount = 0
): number {
  const fromSlots =
    gap.slotsNeeded > 0 ? Math.min(Math.max(1, gap.slotsNeeded), 10) : 0;
  const fromDiversity = gap.hasDiversityGap ? 4 : 0;
  const fromFloor =
    minRecommendationCount > 0
      ? Math.min(Math.max(1, Math.floor(minRecommendationCount)), 10)
      : 0;
  return Math.min(Math.max(fromSlots, fromDiversity, fromFloor), 10);
}

function validateRecommendations(data: unknown): VoteGapFillResponse {
  const empty: VoteGapFillResponse = { recommendations: [] };
  if (!data || typeof data !== "object") return empty;
  const recs = (data as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(recs)) return empty;
  const recommendations = recs.filter((r): r is VoteGapRecommendation => {
    if (!r || typeof r !== "object") return false;
    const x = r as Record<string, unknown>;
    return (
      typeof x.name === "string" &&
      typeof x.searchQuery === "string" &&
      typeof x.reason === "string" &&
      typeof x.fillsGap === "string" &&
      (x.upgradeNote === null || typeof x.upgradeNote === "string")
    );
  });
  return { recommendations };
}

export async function requestVoteGapFill(payload: VoteGapFillRequest): Promise<VoteGapFillResponse> {
  const base = getApiProxyBase();
  const res = await fetch(`${base}/api/openai/vote-gap-fill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`vote-gap-fill failed (${res.status}): ${text || res.statusText}`);
  }
  const data = (await res.json()) as unknown;
  return validateRecommendations(data);
}

export async function requestVoteGapReplacement(
  payload: VoteGapReplacementRequest
): Promise<VoteGapRecommendation | null> {
  const base = getApiProxyBase();
  const res = await fetch(`${base}/api/openai/vote-gap-replacement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("[voteGapFill] replacement HTTP error", res.status, text);
    return null;
  }
  const data = (await res.json()) as VoteGapReplacementResponse;
  const r = data?.recommendation;
  if (
    !r ||
    typeof r.name !== "string" ||
    typeof r.searchQuery !== "string" ||
    typeof r.reason !== "string"
  ) {
    return null;
  }
  return r;
}

function pickBestUsablePlaceForRecommendation(
  places: CandidateActivity[],
  recName: string,
  excludedTags: string[],
  usedPlaceIds: Set<string>,
  usedNormalizedNames: Set<string>
): CandidateActivity | null {
  type Scored = { p: CandidateActivity; score: number; idx: number };
  const usable: Scored[] = [];
  for (let idx = 0; idx < places.length; idx++) {
    const p = places[idx];
    if (!p.placeId || usedPlaceIds.has(p.placeId)) continue;
    if (activityTagsIntersectExcluded(p, excludedTags)) continue;
    const nn = normalizeName(p.name);
    let nameDup = false;
    for (const prev of usedNormalizedNames) {
      if (namesLikelyDuplicate(nn, prev)) {
        nameDup = true;
        break;
      }
    }
    if (nameDup) continue;
    usable.push({ p, score: nameMatchScore(p.name, recName), idx });
  }
  if (usable.length === 0) return null;
  usable.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const best = usable[0];
  if (best.score >= 0.25) return best.p;
  // Weak lexical match: still return a result, prefer earlier Places ranking.
  return usable.reduce((a, b) => (a.idx <= b.idx ? a : b)).p;
}

function rankedFromResolvedPlace(
  activity: CandidateActivity,
  rec: VoteGapRecommendation
): RankedCandidate {
  const descParts = [activity.description?.trim(), rec.upgradeNote?.trim()].filter(Boolean);
  return {
    ...activity,
    source: "auto_recommendation",
    description: descParts.length ? descParts.join(" ") : activity.description,
    aiRecommendationReason: rec.reason.trim(),
    finalScore: -1,
    groupScore: -1,
    avgMemberScore: -1,
    minMemberScore: -1,
    selectedCount: 0,
    isSelectedByAnyMember: false,
  };
}

async function resolveRecommendationWithPlaces(
  destination: string,
  rec: VoteGapRecommendation,
  excludedTags: string[],
  usedPlaceIds: Set<string>,
  usedNormalizedNames: Set<string>,
  signal?: AbortSignal
): Promise<RankedCandidate | null> {
  const queries = [
    `${destination} ${rec.searchQuery}`.trim(),
    `${destination} ${rec.name}`.trim(),
  ];
  for (const textQuery of queries) {
    const batch = await fetchPlacesForDestination({
      destination,
      textQuery,
      maxResults: 20,
      signal,
    });
    const pick = pickBestUsablePlaceForRecommendation(
      batch,
      rec.name,
      excludedTags,
      usedPlaceIds,
      usedNormalizedNames
    );
    if (pick) return rankedFromResolvedPlace(pick, rec);
  }
  return null;
}

/**
 * When the pool is short or lacks diversity vs group prefs, ask OpenAI for concrete places,
 * resolve via Places searchText, optionally one replacement round per slot.
 */
export async function mergeVoteGapAiSuggestions(
  tripId: string,
  ranked: RankedCandidate[],
  opts?: {
    signal?: AbortSignal;
    extraExcludedPlaceIds?: Iterable<string>;
    minRecommendationCount?: number;
    nonFoodDeficit?: number;
  }
): Promise<RankedCandidate[]> {
  const signal = opts?.signal;
  const gap = buildVoteGapReport(tripId, ranked, opts?.nonFoodDeficit ?? 0);
  const minWant = opts?.minRecommendationCount ?? 0;
  const want = voteGapRecommendationCount(gap, minWant);
  if (want === 0 || !shouldTriggerVoteGapFill(gap, minWant)) return ranked;

  const profile = generateGroupPlanningProfile(tripId);
  if (!profile?.destination?.trim()) return ranked;

  const existingCandidates = ranked.map((c) => ({ name: c.name, placeId: c.placeId }));
  const slimProfile = {
    destination: profile.destination,
    commonActiveHours: profile.commonActiveHours,
    groupEnergyLevel: profile.groupEnergyLevel,
    groupBudgetLevel: profile.groupBudgetLevel,
    excludedTags: profile.excludedTags ?? [],
    commonActivityTypes: profile.commonActivityTypes ?? [],
    candidatePlaceHints: (profile.candidatePlaces ?? []).slice(0, 40),
  };

  let recs: VoteGapRecommendation[];
  try {
    recs = (
      await requestVoteGapFill({
        gapReport: gap,
        profile: slimProfile,
        existingCandidates,
        recommendationCount: want,
      })
    ).recommendations;
  } catch (e) {
    console.warn("[voteGapFill] batch request failed", e);
    return ranked;
  }

  recs = recs.slice(0, want);
  const usedPlaceIds = new Set(ranked.map((c) => c.placeId));
  for (const id of opts?.extraExcludedPlaceIds ?? []) {
    const t = String(id).trim();
    if (t) usedPlaceIds.add(t);
  }
  const usedNormalizedNames = new Set(ranked.map((c) => normalizeName(c.name)));
  const excludedTags = profile.excludedTags ?? [];
  const appended: RankedCandidate[] = [...ranked];

  for (const rec of recs) {
    if (appended.length - ranked.length >= want) break;

    let row = await resolveRecommendationWithPlaces(
      profile.destination,
      rec,
      excludedTags,
      usedPlaceIds,
      usedNormalizedNames,
      signal
    );

    if (!row) {
      const replacement = await requestVoteGapReplacement({
        destination: profile.destination,
        failedSuggestion: { name: rec.name, searchQuery: rec.searchQuery },
        excludedTags,
        statedGaps: gap.statedGaps.slice(0, 6),
        budgetFloor: gap.budgetFloor,
        commonActivityTypes: profile.commonActivityTypes ?? [],
        groupEnergyLevel: profile.groupEnergyLevel,
        existingCandidateNames: appended.map((c) => c.name),
      });
      if (replacement) {
        row = await resolveRecommendationWithPlaces(
          profile.destination,
          replacement,
          excludedTags,
          usedPlaceIds,
          usedNormalizedNames,
          signal
        );
      }
    }

    if (row) {
      appended.push(row);
      usedPlaceIds.add(row.placeId);
      usedNormalizedNames.add(normalizeName(row.name));
    }
  }

  if (appended.length > ranked.length) {
    const start = ranked.length;
    const slice = appended.slice(start, start + 8);
    await Promise.all(
      slice.map(async (c) => {
        const r = await enrichDurationWithFoursquare({
          name: c.name,
          destination: profile.destination,
          currentMinutes: c.estimatedDuration,
        });
        c.estimatedDuration = r.minutes;
        c.durationSource = r.source;
      })
    );
  }

  return appended;
}
