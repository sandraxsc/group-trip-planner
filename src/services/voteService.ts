import type { ActivityVote } from "../types/itinerary";
import { cloudReplaceMemberVotes, isVoteCloudEnabled } from "./voteCloudStore";

const STORAGE_KEY = "activityVotes";

function getStorage(): ActivityVote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStorage(votes: ActivityVote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
}

/**
 * Save one member's votes for a trip. Replaces any existing votes from this member for this trip.
 */
export function saveMemberVotes(
  tripId: string,
  memberId: string,
  votes: { placeId: string; vote: "up" | "down" }[]
): void {
  const list = getStorage();
  const withoutThisMember = list.filter(
    (v) => !(v.tripId === tripId && v.memberId === memberId)
  );
  const newVotes: ActivityVote[] = votes.map(({ placeId, vote }) => ({
    tripId,
    memberId,
    placeId,
    vote,
  }));
  setStorage([...withoutThisMember, ...newVotes]);

  // Best-effort cloud sync for cross-device voting progress.
  if (isVoteCloudEnabled()) {
    void cloudReplaceMemberVotes({ tripId, memberId, votes });
  }
}

/**
 * Get all votes for a trip (all members).
 */
export function getVotesByTripId(tripId: string): ActivityVote[] {
  return getStorage().filter((v) => v.tripId === tripId);
}

/**
 * Get votes for a trip grouped by placeId: { placeId -> { up: number, down: number } }.
 */
export function getAggregatedVotesByTripId(
  tripId: string
): Record<string, { up: number; down: number }> {
  const votes = getVotesByTripId(tripId);
  const agg: Record<string, { up: number; down: number }> = {};
  for (const v of votes) {
    if (!agg[v.placeId]) agg[v.placeId] = { up: 0, down: 0 };
    if (v.vote === "up") agg[v.placeId].up++;
    else agg[v.placeId].down++;
  }
  return agg;
}
