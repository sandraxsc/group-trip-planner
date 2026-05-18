import type {
  DealBreakerSelection,
  MemberPreference,
} from "../types/preference";
import { cloudUpsertMemberPreference, isPreferenceCloudEnabled } from "./preferenceCloudStore";

const STORAGE_KEY = "memberPreferences";

/** Migrate legacy string[] deal-breakers to categorized selections. */
export function normalizeDealBreakers(raw: unknown): DealBreakerSelection[] | undefined {
  if (raw == null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  if (raw.length === 0) return [];

  if (typeof raw[0] === "string") {
    return (raw as string[])
      .filter((s) => s && s !== "none")
      .map((tag) => ({ category: "general", tags: [tag] }));
  }

  return (raw as unknown[])
    .map((item): DealBreakerSelection | null => {
      if (typeof item !== "object" || item == null) return null;
      const o = item as Record<string, unknown>;
      const category = typeof o.category === "string" ? o.category.trim() : "";
      const tags = Array.isArray(o.tags)
        ? o.tags.filter((t): t is string => typeof t === "string" && t.length > 0)
        : [];
      const note =
        typeof o.note === "string" && o.note.trim() ? o.note.trim() : undefined;
      if (!category && tags.length === 0 && !note) return null;
      return {
        category: category || "general",
        tags,
        ...(note ? { note } : {}),
      };
    })
    .filter((x): x is DealBreakerSelection => x != null);
}

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
  return getStorage()
    .filter((p) => p.tripId === tripId)
    .map(normalizeMemberPreference);
}
