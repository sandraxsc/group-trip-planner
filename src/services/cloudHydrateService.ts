import type { ActivityVote } from "../types/itinerary";
import type { MemberPreference } from "../types/preference";
import type { TripMember } from "../types/trip";
import { cloudGetTripMembers, isCloudEnabled } from "./tripCloudStore";
import { cloudGetPreferencesByTripId, isPreferenceCloudEnabled } from "./preferenceCloudStore";
import { cloudGetVotesByTripId, isVoteCloudEnabled } from "./voteCloudStore";

const LS_KEYS = {
  MEMBERS: "tripMembers",
  PREFS: "memberPreferences",
  VOTES: "activityVotes",
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function upsertByComposite<T extends { tripId: string; memberId: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const e of existing) map.set(`${e.tripId}::${e.memberId}`, e);
  for (const n of incoming) map.set(`${n.tripId}::${n.memberId}`, { ...(map.get(`${n.tripId}::${n.memberId}`) as T | undefined), ...n });
  return Array.from(map.values());
}

function upsertByMemberId(existing: TripMember[], incoming: TripMember[]): TripMember[] {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, { ...(map.get(m.id) ?? m), ...m });
  return Array.from(map.values());
}

function upsertVotes(existing: ActivityVote[], incoming: ActivityVote[]): ActivityVote[] {
  // Vote key: tripId + memberId + placeId
  const map = new Map(existing.map((v) => [`${v.tripId}::${v.memberId}::${v.placeId}`, v]));
  for (const v of incoming) map.set(`${v.tripId}::${v.memberId}::${v.placeId}`, v);
  return Array.from(map.values());
}

export async function hydrateTripFromCloud(tripId: string): Promise<{
  members?: TripMember[];
  preferences?: MemberPreference[];
  votes?: ActivityVote[];
}> {
  const out: { members?: TripMember[]; preferences?: MemberPreference[]; votes?: ActivityVote[] } = {};

  if (isCloudEnabled()) {
    const m = await cloudGetTripMembers(tripId);
    if (m.ok) {
      const existing = readJson<TripMember[]>(LS_KEYS.MEMBERS, []);
      const merged = upsertByMemberId(existing, m.data);
      writeJson(LS_KEYS.MEMBERS, merged);
      out.members = m.data;
    }
  }

  if (isPreferenceCloudEnabled()) {
    const p = await cloudGetPreferencesByTripId(tripId);
    if (p.ok) {
      const existing = readJson<MemberPreference[]>(LS_KEYS.PREFS, []);
      const merged = upsertByComposite(existing, p.data);
      writeJson(LS_KEYS.PREFS, merged);
      out.preferences = p.data;
    }
  }

  if (isVoteCloudEnabled()) {
    const v = await cloudGetVotesByTripId(tripId);
    if (v.ok) {
      const existing = readJson<ActivityVote[]>(LS_KEYS.VOTES, []);
      const merged = upsertVotes(existing, v.data);
      writeJson(LS_KEYS.VOTES, merged);
      out.votes = v.data;
    }
  }

  return out;
}

