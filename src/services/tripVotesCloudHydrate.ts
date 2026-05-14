import type { ActivityVote } from "../types/itinerary";
import { getSupabaseClient } from "../config/supabaseClient";
import { cloudGetVotesByTripId } from "./voteCloudStore";

/** Returns cloud vote rows when Supabase is configured and the fetch succeeds; otherwise null. */
export async function fetchTripVotesFromCloud(tripId: string): Promise<ActivityVote[] | null> {
  if (!getSupabaseClient()) return null;
  const v = await cloudGetVotesByTripId(tripId);
  if (!v.ok) return null;
  return v.data;
}
