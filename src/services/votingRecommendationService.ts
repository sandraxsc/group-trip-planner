import type { RankedCandidate } from "../types/activity";
import { getRankedVoteCandidates } from "./activityEngine";
import { mergeVoteGapAiSuggestions } from "./voteGapFillService";

export type AIVotingRecommendationsOpts = {
  excludePlaceIds?: string[];
  signal?: AbortSignal;
  /** Itinerary non-food gap-fill: request at least this many AI rows (caller should cap at 10). */
  minRecommendationCount?: number;
  /** Passed into vote-gap prompt as a stated gap for non-dining activities. */
  nonFoodDeficit?: number;
};

/**
 * AI-backed vote-pool gap fill for itinerary recovery: returns **new** ranked rows
 * not present in the current trip candidate list, while blocking given placeIds
 * from being resolved (e.g. majority-downvoted removals).
 */
export async function getAIVotingRecommendations(
  tripId: string,
  opts?: AIVotingRecommendationsOpts
): Promise<RankedCandidate[]> {
  const exclude = new Set(
    (opts?.excludePlaceIds ?? []).map((id) => String(id).trim()).filter(Boolean)
  );
  const base = await getRankedVoteCandidates(tripId);
  const pool = base.filter((c) => !exclude.has(c.placeId));
  const poolIds = new Set(pool.map((c) => c.placeId));
  const merged = await mergeVoteGapAiSuggestions(tripId, pool, {
    signal: opts?.signal,
    extraExcludedPlaceIds: exclude,
    minRecommendationCount: opts?.minRecommendationCount,
    nonFoodDeficit: opts?.nonFoodDeficit,
  });
  return merged.filter((c) => !poolIds.has(c.placeId));
}
