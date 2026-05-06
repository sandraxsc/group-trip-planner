import type { MemberPreference } from "../types/preference";
import { cloudUpsertMemberPreference, isPreferenceCloudEnabled } from "./preferenceCloudStore";

const STORAGE_KEY = "memberPreferences";

function getStorage(): MemberPreference[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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
  return found ? { ...found } : null;
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
  const merged: MemberPreference = {
    memberId,
    tripId,
    ...existing,
    ...data,
  };
  if (idx >= 0) {
    list[idx] = merged;
  } else {
    list.push(merged);
  }
  setStorage(list);

  // Best-effort cloud sync so other devices can see group preferences.
  if (isPreferenceCloudEnabled()) {
    void cloudUpsertMemberPreference(merged);
  }
}

/**
 * All members' preferences for a trip (for aggregation).
 */
export function getMemberPreferencesByTripId(
  tripId: string
): MemberPreference[] {
  return getStorage().filter((p) => p.tripId === tripId);
}
