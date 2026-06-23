import type { MemberPreference } from "../types/preference";
import { normalizeDealBreakers } from "../types/preference";
import { cloudUpsertMemberPreference, isPreferenceCloudEnabled } from "./preferenceCloudStore";
import { getActiveItinerary } from "./itineraryCloudStore";
import { setTripOutdated } from "./tripCloudStore";
import { applyLocalTripOutdatedFlag } from "./tripService";

export { normalizeDealBreakers } from "../types/preference";

const STORAGE_KEY = "memberPreferences";

function normalizeMemberPreference(pref: MemberPreference): MemberPreference {
  return {
    ...pref,
    mbti: pref.mbti ?? null,
    dealBreakers: normalizeDealBreakers(pref.dealBreakers),
  };
}

function getStorage(): MemberPreference[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: MemberPreference[] = raw ? JSON.parse(raw) : [];
    return list.map(normalizeMemberPreference);
  } catch {
    return [];
  }
}

function setStorage(prefs: MemberPreference[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Get one member's preference for a trip (may be partial until flow is complete).
 */
export function getMemberPreference(
  tripId: string,
  memberId: string
): MemberPreference | null {
  const list = getStorage();
  const found = list.find(
    (p) => p.tripId === tripId && p.memberId === memberId
  );
  return found ? normalizeMemberPreference(found) : null;
}

/**
 * Merge partial preference into existing and save. Creates record if none exists.
 */
export function saveMemberPreference(
  tripId: string,
  memberId: string,
  data: Partial<Omit<MemberPreference, "memberId" | "tripId">>
): void {
  const list = getStorage();
  const idx = list.findIndex(
    (p) => p.tripId === tripId && p.memberId === memberId
  );
  const existing = idx >= 0 ? list[idx] : null;
  const normalizedData = {
    ...data,
    ...(data.dealBreakers !== undefined
      ? { dealBreakers: normalizeDealBreakers(data.dealBreakers) }
      : {}),
  };
  const merged: MemberPreference = normalizeMemberPreference({
    memberId,
    tripId,
    mbti: null,
    ...existing,
    ...normalizedData,
  });
  if (idx >= 0) {
    list[idx] = merged;
  } else {
    list.push(merged);
  }
  setStorage(list);

  void markTripOutdatedIfItineraryExists(tripId);

  // Best-effort cloud sync so other devices can see group preferences.
  if (isPreferenceCloudEnabled()) {
    void cloudUpsertMemberPreference(merged).then((result) => {
      if (!result.ok) {
        // eslint-disable-next-line no-console
        console.warn("[preferenceService] cloud upsert failed:", result.error);
      }
    });
  }
}

async function markTripOutdatedIfItineraryExists(tripId: string): Promise<void> {
  const active = await getActiveItinerary(tripId);
  if (!active) return;
  await setTripOutdated(tripId, true);
  applyLocalTripOutdatedFlag(tripId, true);
}

/**
 * All members' preferences for a trip (for aggregation).
 */
export function getMemberPreferencesByTripId(
  tripId: string
): MemberPreference[] {
  return getStorage()
    .filter((p) => p.tripId === tripId)
    .map(normalizeMemberPreference);
}
