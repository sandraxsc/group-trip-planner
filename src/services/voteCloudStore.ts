import type { ActivityVote } from "../types/itinerary";
import { getSupabaseClient } from "../config/supabaseClient";

type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string };

function sb() {
  return getSupabaseClient();
}

export function isVoteCloudEnabled(): boolean {
  return sb() != null;
}

export async function cloudReplaceMemberVotes(args: {
  tripId: string;
  memberId: string;
  votes: { placeId: string; vote: "up" | "down" }[];
}): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  // Delete existing votes for member/trip, then insert.
  const { error: delErr } = await client.from("activity_votes").delete().eq("tripId", args.tripId).eq("memberId", args.memberId);
  if (delErr) return { ok: false, error: delErr.message };

  const rows: ActivityVote[] = args.votes.map((v) => ({
    tripId: args.tripId,
    memberId: args.memberId,
    placeId: v.placeId,
    vote: v.vote,
  }));

  if (rows.length === 0) return { ok: true, data: null };

  const { error: insErr } = await client.from("activity_votes").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true, data: null };
}

export async function cloudGetVotesByTripId(tripId: string): Promise<CloudResult<ActivityVote[]>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("activity_votes").select("*").eq("tripId", tripId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as ActivityVote[]) ?? [] };
}

