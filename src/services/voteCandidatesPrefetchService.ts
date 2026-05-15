import type { RankedCandidate } from "../types/activity";
import { generateCandidateActivities } from "./activityEngine";
import { generateGroupPlanningProfile } from "./planningService";
import { getMemberPreferencesByTripId } from "./preferenceService";
import { getTripById, getTripMembers } from "./tripService";
import { mergeVoteGapAiSuggestions } from "./voteGapFillService";

const LS_PREFIX = "voteCandidatesPrefetch:";

/** Bump when cache shape or pipeline changes so old entries are ignored. */
const CACHE_VERSION = 1;

export interface VoteCandidatesPrefetchEntry {
  v: number;
  fingerprint: string;
  builtAt: number;
  candidates: RankedCandidate[];
}

function stableStringifyPrefs(tripId: string): string {
  const prefs = getMemberPreferencesByTripId(tripId)
    .slice()
    .sort((a, b) => a.memberId.localeCompare(b.memberId));
  return JSON.stringify(
    prefs.map((p) => ({
      memberId: p.memberId,
      budgetLevel: p.budgetLevel,
      energyLevel: p.energyLevel,
      activeHours: p.activeHours,
      activityTypes: p.activityTypes?.slice().sort(),
      selectedPlaces: p.selectedPlaces?.slice().sort(),
      dealBreakers: p.dealBreakers?.slice().sort(),
      mbti: p.mbti ?? null,
    }))
  );
}

/**
 * Fingerprint of everything that affects vote candidate generation for this trip.
 * When it changes, prefetch and Vote screen must recompute.
 */
export function computeVoteCandidatesFingerprint(tripId: string): string {
  const trip = getTripById(tripId);
  const members = getTripMembers(tripId)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => ({ id: m.id, preferenceStatus: m.preferenceStatus }));
  const profile = generateGroupPlanningProfile(tripId);
  const payload = {
    tripId,
    destination: trip?.destination ?? "",
    tripDays: trip?.tripDays ?? null,
    tripName: trip?.name ?? "",
    members,
    prefs: stableStringifyPrefs(tripId),
    profile: {
      groupBudgetLevel: profile?.groupBudgetLevel,
      groupEnergyLevel: profile?.groupEnergyLevel,
      commonActiveHours: profile?.commonActiveHours,
      commonActivityTypes: profile?.commonActivityTypes?.slice().sort(),
      excludedTags: profile?.excludedTags?.slice().sort(),
      candidatePlaces: profile?.candidatePlaces?.slice().sort(),
    },
  };
  return JSON.stringify(payload);
}

function lsKey(tripId: string): string {
  return `${LS_PREFIX}${tripId}`;
}

export function getCachedVoteCandidates(
  tripId: string,
  fingerprint: string
): RankedCandidate[] | null {
  try {
    const raw = localStorage.getItem(lsKey(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VoteCandidatesPrefetchEntry;
    if (!parsed || parsed.v !== CACHE_VERSION || parsed.fingerprint !== fingerprint) return null;
    if (!Array.isArray(parsed.candidates) || parsed.candidates.length === 0) return null;
    return parsed.candidates;
  } catch {
    return null;
  }
}

export function setCachedVoteCandidates(
  tripId: string,
  fingerprint: string,
  candidates: RankedCandidate[]
): void {
  try {
    const entry: VoteCandidatesPrefetchEntry = {
      v: CACHE_VERSION,
      fingerprint,
      builtAt: Date.now(),
      candidates,
    };
    localStorage.setItem(lsKey(tripId), JSON.stringify(entry));
  } catch (e) {
    console.warn("[voteCandidatesPrefetch] cache write failed", e);
  }
}

/**
 * Build ranked vote list + gap-fill in the background. Safe to call repeatedly;
 * skips work when cache already matches fingerprint.
 */
export async function prefetchVoteCandidatesForTrip(tripId: string): Promise<void> {
  if (!tripId?.trim()) return;
  const fingerprintBefore = computeVoteCandidatesFingerprint(tripId);
  if (getCachedVoteCandidates(tripId, fingerprintBefore)) return;

  try {
    const ranked = await generateCandidateActivities(tripId);
    const merged = await mergeVoteGapAiSuggestions(tripId, ranked);
    const fingerprintAfter = computeVoteCandidatesFingerprint(tripId);
    if (fingerprintAfter !== fingerprintBefore) return;
    setCachedVoteCandidates(tripId, fingerprintAfter, merged);
  } catch (e) {
    console.warn("[voteCandidatesPrefetch] prefetch failed", e);
  }
}
